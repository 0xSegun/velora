"""
Model Evaluation.

Computes MAE, RMSE, MAPE, R² metrics, plus per-country evaluation,
confidence calibration, and back-testing utilities.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import torch
from torch.utils.data import DataLoader

from ai.model.transformer import TSTransformer
from ai.pipeline.dataset import InflationDataset
from ai.pipeline.preprocess import DataPreprocessor

logger = logging.getLogger(__name__)


@dataclass
class EvalMetrics:
    """Container for evaluation metrics."""

    mae: float = 0.0
    rmse: float = 0.0
    mape: float = 0.0
    r2: float = 0.0
    n_samples: int = 0
    per_horizon: dict[int, dict[str, float]] = field(default_factory=dict)

    def summary(self) -> str:
        lines = [
            "EvalMetrics:",
            f"  MAE  = {self.mae:.4f}",
            f"  RMSE = {self.rmse:.4f}",
            f"  MAPE = {self.mape:.2f}%",
            f"  R²   = {self.r2:.4f}",
            f"  N    = {self.n_samples}",
        ]
        if self.per_horizon:
            lines.append("  Per-horizon:")
            for h, m in sorted(self.per_horizon.items()):
                lines.append(
                    f"    h={h}: MAE={m['mae']:.4f}  RMSE={m['rmse']:.4f}"
                )
        return "\n".join(lines)


class ModelEvaluator:
    """Evaluate a trained TSTransformer on held-out data.

    Parameters
    ----------
    model : TSTransformer
        Trained model (already on the target device).
    preprocessor : DataPreprocessor | None
        If provided, predictions are inverse-scaled back to the original
        domain before computing metrics.
    device : str | torch.device
        Evaluation device.
    """

    def __init__(
        self,
        model: TSTransformer,
        preprocessor: Optional[DataPreprocessor] = None,
        device: str | torch.device | None = None,
    ) -> None:
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device)
        self.model = model.to(self.device)
        self.model.eval()
        self.preprocessor = preprocessor

    # ------------------------------------------------------------------
    # Core metrics
    # ------------------------------------------------------------------
    @staticmethod
    def _mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        return float(np.mean(np.abs(y_true - y_pred)))

    @staticmethod
    def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

    @staticmethod
    def _mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        mask = np.abs(y_true) > 1e-8
        if not mask.any():
            return 0.0
        return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)

    @staticmethod
    def _r2(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        if ss_tot < 1e-10:
            return 0.0
        return float(1.0 - ss_res / ss_tot)

    # ------------------------------------------------------------------
    # Evaluate a dataset
    # ------------------------------------------------------------------
    @torch.no_grad()
    def evaluate(
        self,
        dataset: InflationDataset,
        batch_size: int = 64,
    ) -> EvalMetrics:
        """Run the model on *dataset* and compute aggregate metrics.

        Parameters
        ----------
        dataset : InflationDataset
            Evaluation dataset.
        batch_size : int
            Batch size for the DataLoader.

        Returns
        -------
        EvalMetrics
        """
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)

        all_preds: list[np.ndarray] = []
        all_targets: list[np.ndarray] = []

        for batch_x, batch_y in loader:
            batch_x = batch_x.to(self.device)
            outputs = self.model(batch_x)
            preds = outputs["inflation_rate"].cpu().numpy()
            all_preds.append(preds)
            all_targets.append(batch_y.numpy())

        preds_arr = np.concatenate(all_preds, axis=0)  # (N, horizon)
        targets_arr = np.concatenate(all_targets, axis=0)

        # Inverse-scale if preprocessor available
        if self.preprocessor is not None:
            n, h = preds_arr.shape
            preds_arr = self.preprocessor.inverse_transform_target(
                preds_arr.reshape(-1, 1)
            ).reshape(n, h)
            targets_arr = self.preprocessor.inverse_transform_target(
                targets_arr.reshape(-1, 1)
            ).reshape(n, h)

        # Aggregate over all horizons
        metrics = EvalMetrics(
            mae=self._mae(targets_arr, preds_arr),
            rmse=self._rmse(targets_arr, preds_arr),
            mape=self._mape(targets_arr, preds_arr),
            r2=self._r2(targets_arr.flatten(), preds_arr.flatten()),
            n_samples=len(preds_arr),
        )

        # Per-horizon breakdown
        horizon = preds_arr.shape[1]
        for h in range(horizon):
            metrics.per_horizon[h + 1] = {
                "mae": self._mae(targets_arr[:, h], preds_arr[:, h]),
                "rmse": self._rmse(targets_arr[:, h], preds_arr[:, h]),
                "mape": self._mape(targets_arr[:, h], preds_arr[:, h]),
                "r2": self._r2(targets_arr[:, h], preds_arr[:, h]),
            }

        logger.info(metrics.summary())
        return metrics

    # ------------------------------------------------------------------
    # Prediction vs Actual Data
    # ------------------------------------------------------------------
    @torch.no_grad()
    def prediction_vs_actual(
        self,
        dataset: InflationDataset,
        batch_size: int = 64,
    ) -> dict[str, np.ndarray]:
        """Generate parallel arrays of predictions and actuals.

        Returns
        -------
        dict[str, np.ndarray]
            ``{"predictions": ..., "actuals": ..., "residuals": ...}``
        """
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)

        preds_list: list[np.ndarray] = []
        targets_list: list[np.ndarray] = []

        for batch_x, batch_y in loader:
            batch_x = batch_x.to(self.device)
            outputs = self.model(batch_x)
            preds_list.append(outputs["inflation_rate"].cpu().numpy())
            targets_list.append(batch_y.numpy())

        preds = np.concatenate(preds_list, axis=0)
        actuals = np.concatenate(targets_list, axis=0)

        if self.preprocessor is not None:
            n, h = preds.shape
            preds = self.preprocessor.inverse_transform_target(
                preds.reshape(-1, 1)
            ).reshape(n, h)
            actuals = self.preprocessor.inverse_transform_target(
                actuals.reshape(-1, 1)
            ).reshape(n, h)

        return {
            "predictions": preds,
            "actuals": actuals,
            "residuals": actuals - preds,
        }

    # ------------------------------------------------------------------
    # Confidence Calibration
    # ------------------------------------------------------------------
    @torch.no_grad()
    def confidence_calibration(
        self,
        dataset: InflationDataset,
        batch_size: int = 64,
        n_bins: int = 10,
    ) -> dict[str, np.ndarray]:
        """Bin predictions by confidence and check if accuracy correlates.

        Returns
        -------
        dict[str, np.ndarray]
            ``{"bin_edges": ..., "mean_confidence": ..., "mean_accuracy": ...}``
        """
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)

        confidences: list[float] = []
        errors: list[float] = []

        for batch_x, batch_y in loader:
            batch_x = batch_x.to(self.device)
            outputs = self.model(batch_x)
            conf = outputs["confidence_score"].cpu().numpy().flatten()
            pred = outputs["inflation_rate"].cpu().numpy()
            tgt = batch_y.numpy()
            err = np.abs(pred - tgt).mean(axis=1)  # per-sample error
            confidences.extend(conf.tolist())
            errors.extend(err.tolist())

        confidences_arr = np.array(confidences)
        errors_arr = np.array(errors)

        # Bin by confidence
        bin_edges = np.linspace(0, 1, n_bins + 1)
        mean_conf = np.zeros(n_bins)
        mean_acc = np.zeros(n_bins)

        for i in range(n_bins):
            lo, hi = bin_edges[i], bin_edges[i + 1]
            mask = (confidences_arr >= lo) & (confidences_arr < hi)
            if mask.sum() > 0:
                mean_conf[i] = confidences_arr[mask].mean()
                # "accuracy" = 1 - normalised error
                mean_acc[i] = 1.0 - errors_arr[mask].mean()
            else:
                mean_conf[i] = (lo + hi) / 2
                mean_acc[i] = np.nan

        return {
            "bin_edges": bin_edges,
            "mean_confidence": mean_conf,
            "mean_accuracy": mean_acc,
        }

    # ------------------------------------------------------------------
    # Back-testing
    # ------------------------------------------------------------------
    @torch.no_grad()
    def backtest(
        self,
        dataset: InflationDataset,
        batch_size: int = 64,
    ) -> list[dict]:
        """Walk-forward back-test on historical data.

        Each sample produces a record with prediction, actual, error,
        and confidence.

        Returns
        -------
        list[dict]
            One dict per sample.
        """
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)
        records: list[dict] = []

        for batch_x, batch_y in loader:
            batch_x = batch_x.to(self.device)
            outputs = self.model(batch_x)
            pred = outputs["inflation_rate"].cpu().numpy()
            conf = outputs["confidence_score"].cpu().numpy().flatten()
            risk = outputs["risk_level"].cpu().numpy().flatten()
            tgt = batch_y.numpy()

            for i in range(len(pred)):
                records.append(
                    {
                        "prediction": pred[i].tolist(),
                        "actual": tgt[i].tolist(),
                        "mae": float(np.abs(pred[i] - tgt[i]).mean()),
                        "confidence": float(conf[i]),
                        "risk_level": float(risk[i]),
                    }
                )

        logger.info("Back-test completed: %d records", len(records))
        return records
