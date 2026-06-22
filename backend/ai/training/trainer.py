"""
Complete Training Loop for the TSTransformer.

Supports AdamW optimiser, cosine / step / plateau LR scheduling,
early stopping, gradient clipping, model check-pointing, and
TensorBoard-compatible logging.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from ai.model.transformer import TSTransformer
from ai.pipeline.dataset import InflationDataset
from ai.training.config import TrainingConfig

logger = logging.getLogger(__name__)


# =====================================================================
#  Multi-task loss
# =====================================================================
class MultiTaskLoss(nn.Module):
    """Weighted sum of task-specific losses for TSTransformer outputs.

    Tasks
    -----
    * ``inflation_rate`` – MSE
    * ``deflation_probability`` – BCE  (binary cross-entropy)
    * ``trend_direction`` – Cross-entropy (3-class)
    * ``confidence_score`` – MSE
    * ``risk_level`` – MSE
    """

    def __init__(self, config: TrainingConfig) -> None:
        super().__init__()
        self.w_inf = config.loss_weight_inflation
        self.w_def = config.loss_weight_deflation
        self.w_trend = config.loss_weight_trend
        self.w_conf = config.loss_weight_confidence
        self.w_risk = config.loss_weight_risk

        self.mse = nn.MSELoss()
        self.bce = nn.BCELoss()
        self.ce = nn.CrossEntropyLoss()

    def forward(
        self,
        outputs: dict[str, torch.Tensor],
        targets: torch.Tensor,
    ) -> tuple[torch.Tensor, dict[str, float]]:
        """Compute total loss and per-task breakdown.

        Parameters
        ----------
        outputs : dict
            Model outputs from ``TSTransformer.forward()``.
        targets : torch.Tensor
            Shape ``(batch, forecast_horizon)`` — scaled inflation rates.

        Returns
        -------
        tuple[torch.Tensor, dict[str, float]]
            ``(total_loss, loss_dict)``
        """
        # 1. Inflation rate — primary regression target
        loss_inf = self.mse(outputs["inflation_rate"], targets)

        # 2. Deflation probability — binary: target < 0 ⇒ deflation
        #    We derive pseudo-labels from the mean target inflation value.
        target_mean = targets.mean(dim=1, keepdim=True)
        deflation_label = (target_mean < 0.3).float()  # 0.3 is scaled threshold
        deflation_pred = outputs["deflation_prob"].mean(dim=1, keepdim=True).clamp(1e-6, 1.0 - 1e-6)
        loss_def = self.bce(deflation_pred, deflation_label)

        # 3. Trend direction — 3-class derived from first vs last target step
        if targets.shape[1] == 1:
            trend_labels = torch.ones(len(targets), dtype=torch.long, device=targets.device)
        else:
            trend_diff = targets[:, -1] - targets[:, 0]
            trend_labels = torch.ones(len(trend_diff), dtype=torch.long, device=targets.device)
            trend_labels[trend_diff > 0.02] = 2  # up
            trend_labels[trend_diff < -0.02] = 0  # down
        loss_trend = self.ce(outputs["trend_direction"], trend_labels)

        # 4. Confidence — no ground truth; we use inverse of prediction error
        #    as a soft pseudo-label (self-supervised calibration signal).
        with torch.no_grad():
            pred_error = (outputs["inflation_rate"] - targets).abs().mean(dim=1, keepdim=True)
            conf_label = torch.exp(-pred_error * 5).clamp(0, 1)
        loss_conf = self.mse(outputs["confidence_score"].unsqueeze(-1), conf_label)

        # 5. Risk — derived from target volatility (std across horizon)
        with torch.no_grad():
            if targets.shape[1] == 1:
                risk_label = (targets[:, 0:1].abs() * 50).clamp(0, 100)
            else:
                target_std = targets.std(dim=1, keepdim=True)
                risk_label = (target_std * 100).clamp(0, 100)
        loss_risk = self.mse(outputs["risk_level"].unsqueeze(-1), risk_label)

        total = (
            self.w_inf * loss_inf
            + self.w_def * loss_def
            + self.w_trend * loss_trend
            + self.w_conf * loss_conf
            + self.w_risk * loss_risk
        )

        breakdown = {
            "inflation": loss_inf.item(),
            "deflation": loss_def.item(),
            "trend": loss_trend.item(),
            "confidence": loss_conf.item(),
            "risk": loss_risk.item(),
            "total": total.item(),
        }
        return total, breakdown


# =====================================================================
#  Early stopping helper
# =====================================================================
class EarlyStopping:
    """Stop training when validation loss has not improved for *patience* epochs."""

    def __init__(self, patience: int = 10, min_delta: float = 1e-5) -> None:
        self.patience = patience
        self.min_delta = min_delta
        self.counter = 0
        self.best_loss: float | None = None
        self.should_stop = False

    def step(self, val_loss: float) -> bool:
        if self.best_loss is None or val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.should_stop = True
        return self.should_stop


# =====================================================================
#  Trainer
# =====================================================================
class Trainer:
    """End-to-end trainer for the TSTransformer.

    Parameters
    ----------
    model : TSTransformer
        Model instance.
    config : TrainingConfig
        Hyper-parameters and paths.
    device : str | torch.device
        Training device (``"cpu"`` or ``"cuda"``).
    """

    def __init__(
        self,
        model: TSTransformer,
        config: TrainingConfig,
        device: str | torch.device | None = None,
    ) -> None:
        self.config = config
        config.ensure_dirs()

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device)
        self.model = model.to(self.device)

        # Optimiser
        self.optimiser = torch.optim.AdamW(
            self.model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )

        # Scheduler
        self.scheduler = self._build_scheduler()

        # Loss
        self.criterion = MultiTaskLoss(config)

        # Early stopping
        self.early_stopping = EarlyStopping(patience=config.early_stopping_patience)

        # History tracking
        self.history: dict[str, list[float]] = {
            "train_loss": [],
            "val_loss": [],
            "lr": [],
        }

        self.best_val_loss = float("inf")
        self.best_epoch = 0

    # ------------------------------------------------------------------
    # LR Scheduler
    # ------------------------------------------------------------------
    def _build_scheduler(self) -> torch.optim.lr_scheduler.LRScheduler:
        cfg = self.config
        if cfg.scheduler == "cosine":
            return torch.optim.lr_scheduler.CosineAnnealingLR(
                self.optimiser, T_max=cfg.num_epochs, eta_min=1e-7
            )
        elif cfg.scheduler == "step":
            return torch.optim.lr_scheduler.StepLR(
                self.optimiser, step_size=30, gamma=0.5
            )
        elif cfg.scheduler == "plateau":
            return torch.optim.lr_scheduler.ReduceLROnPlateau(
                self.optimiser, mode="min", factor=0.5, patience=5
            )
        else:
            raise ValueError(f"Unknown scheduler: {cfg.scheduler}")

    # ------------------------------------------------------------------
    # Single epoch
    # ------------------------------------------------------------------
    def _train_epoch(self, loader: DataLoader) -> float:
        self.model.train()
        total_loss = 0.0

        for batch_x, batch_y in loader:
            batch_x = batch_x.to(self.device)
            batch_y = batch_y.to(self.device)

            self.optimiser.zero_grad()
            outputs = self.model(batch_x)
            loss, _ = self.criterion(outputs, batch_y)
            loss.backward()

            if self.config.gradient_clip_val > 0:
                nn.utils.clip_grad_norm_(
                    self.model.parameters(), self.config.gradient_clip_val
                )

            self.optimiser.step()
            total_loss += loss.item() * len(batch_x)

        return total_loss / len(loader.dataset)

    @torch.no_grad()
    def _validate_epoch(self, loader: DataLoader) -> tuple[float, dict[str, float]]:
        self.model.eval()
        total_loss = 0.0
        breakdown_accum: dict[str, float] = {}

        for batch_x, batch_y in loader:
            batch_x = batch_x.to(self.device)
            batch_y = batch_y.to(self.device)

            outputs = self.model(batch_x)
            loss, breakdown = self.criterion(outputs, batch_y)
            total_loss += loss.item() * len(batch_x)

            for k, v in breakdown.items():
                breakdown_accum[k] = breakdown_accum.get(k, 0.0) + v * len(batch_x)

        n = len(loader.dataset)
        avg_breakdown = {k: v / n for k, v in breakdown_accum.items()}
        return total_loss / n, avg_breakdown

    # ------------------------------------------------------------------
    # Check-pointing
    # ------------------------------------------------------------------
    def _save_checkpoint(self, epoch: int, val_loss: float, is_best: bool) -> str:
        ckpt_dir = Path(self.config.checkpoint_dir)
        state = {
            "epoch": epoch,
            "model_state_dict": self.model.state_dict(),
            "optimiser_state_dict": self.optimiser.state_dict(),
            "scheduler_state_dict": self.scheduler.state_dict(),
            "val_loss": val_loss,
            "config": self.config.__dict__,
        }

        # Always save latest
        latest_path = ckpt_dir / "latest.pt"
        torch.save(state, latest_path)

        if is_best:
            best_path = ckpt_dir / "best_model.pt"
            torch.save(state, best_path)
            logger.info("  ✓ New best model saved (val_loss=%.6f)", val_loss)
            return str(best_path)

        return str(latest_path)

    def load_checkpoint(self, path: str | Path) -> int:
        """Load a checkpoint and return the epoch number."""
        ckpt = torch.load(path, map_location=self.device, weights_only=False)
        self.model.load_state_dict(ckpt["model_state_dict"])
        self.optimiser.load_state_dict(ckpt["optimiser_state_dict"])
        self.scheduler.load_state_dict(ckpt["scheduler_state_dict"])
        logger.info("Loaded checkpoint from %s (epoch %d)", path, ckpt["epoch"])
        return ckpt["epoch"]

    # ------------------------------------------------------------------
    # Main training loop
    # ------------------------------------------------------------------
    def train(
        self,
        train_dataset: InflationDataset,
        val_dataset: InflationDataset,
        resume_from: Optional[str | Path] = None,
    ) -> dict[str, list[float]]:
        """Run the full training loop.

        Parameters
        ----------
        train_dataset, val_dataset : InflationDataset
            Training and validation datasets.
        resume_from : str | Path | None
            Path to a checkpoint to resume from.

        Returns
        -------
        dict[str, list[float]]
            Training history with keys ``train_loss``, ``val_loss``, ``lr``.
        """
        start_epoch = 0
        if resume_from is not None:
            start_epoch = self.load_checkpoint(resume_from) + 1

        train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            num_workers=self.config.num_workers,
            pin_memory=self.config.pin_memory,
            drop_last=False,
        )
        val_loader = DataLoader(
            val_dataset,
            batch_size=self.config.batch_size,
            shuffle=False,
            num_workers=self.config.num_workers,
            pin_memory=self.config.pin_memory,
        )

        logger.info(
            "Starting training: %d epochs, device=%s, train=%d, val=%d",
            self.config.num_epochs,
            self.device,
            len(train_dataset),
            len(val_dataset),
        )

        for epoch in range(start_epoch, self.config.num_epochs):
            t0 = time.time()

            train_loss = self._train_epoch(train_loader)
            val_loss, val_breakdown = self._validate_epoch(val_loader)
            current_lr = self.optimiser.param_groups[0]["lr"]

            # Update scheduler
            if isinstance(self.scheduler, torch.optim.lr_scheduler.ReduceLROnPlateau):
                self.scheduler.step(val_loss)
            else:
                self.scheduler.step()

            # History
            self.history["train_loss"].append(train_loss)
            self.history["val_loss"].append(val_loss)
            self.history["lr"].append(current_lr)

            # Check-pointing
            is_best = val_loss < self.best_val_loss
            if is_best:
                self.best_val_loss = val_loss
                self.best_epoch = epoch
            self._save_checkpoint(epoch, val_loss, is_best)

            elapsed = time.time() - t0
            logger.info(
                "Epoch %3d/%d  |  train_loss=%.6f  val_loss=%.6f  "
                "lr=%.2e  time=%.1fs%s",
                epoch + 1,
                self.config.num_epochs,
                train_loss,
                val_loss,
                current_lr,
                elapsed,
                "  ★" if is_best else "",
            )

            # Early stopping
            if self.early_stopping.step(val_loss):
                logger.info(
                    "Early stopping triggered at epoch %d (best=%d, val_loss=%.6f)",
                    epoch + 1,
                    self.best_epoch + 1,
                    self.best_val_loss,
                )
                break

        logger.info(
            "Training complete. Best epoch=%d, best_val_loss=%.6f",
            self.best_epoch + 1,
            self.best_val_loss,
        )
        return self.history

    # ------------------------------------------------------------------
    # Log export (TensorBoard-compatible dict)
    # ------------------------------------------------------------------
    def export_logs(self) -> list[dict]:
        """Export training history as a list of per-epoch dicts.

        Suitable for writing to a JSON log or TensorBoard ``SummaryWriter``.
        """
        logs = []
        for i in range(len(self.history["train_loss"])):
            logs.append(
                {
                    "epoch": i + 1,
                    "train_loss": self.history["train_loss"][i],
                    "val_loss": self.history["val_loss"][i],
                    "lr": self.history["lr"][i],
                }
            )
        return logs
