"""
Training configuration dataclass for the TS-Transformer model.

Centralizes all hyperparameters, paths, and training settings
into a single, type-safe configuration object.
"""

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class TrainingConfig:
    """
    Configuration for TS-Transformer training.
    """

    # Training
    batch_size: int = 32
    learning_rate: float = 2e-4
    num_epochs: int = 80
    early_stopping_patience: int = 12

    # Data
    window_size: int = 12
    forecast_horizon: int = 1
    n_features: int = 13  # 8 macro + inflation + 4 event (zeroed during training)
    test_ratio: float = 0.2
    val_ratio: float = 0.15

    # Model architecture
    d_model: int = 128
    nhead: int = 8
    num_layers: int = 4
    dim_feedforward: int = 512
    dropout: float = 0.1

    # Optimization
    weight_decay: float = 1e-5
    scheduler: str = "cosine"
    gradient_clip: float = 1.0

    # Multi-task loss weights
    loss_weight_inflation: float = 1.0
    loss_weight_deflation: float = 0.05
    loss_weight_trend: float = 0.05
    loss_weight_confidence: float = 0.02
    loss_weight_risk: float = 0.02

    # DataLoader
    num_workers: int = 0
    pin_memory: bool = False

    # Paths (relative to backend root)
    checkpoint_dir: str = "models"
    model_save_path: str = "models/best_model.pt"
    scaler_save_path: str = "models/scaler.pkl"

    @property
    def gradient_clip_val(self) -> float:
        """Alias used by Trainer."""
        return self.gradient_clip

    def ensure_dirs(self) -> None:
        """Create checkpoint and model directories."""
        Path(self.checkpoint_dir).mkdir(parents=True, exist_ok=True)
        for path in (self.model_save_path, self.scaler_save_path):
            parent = Path(path).parent
            if str(parent) not in ("", "."):
                parent.mkdir(parents=True, exist_ok=True)

    def resolved_paths(self, backend_root: Path) -> "TrainingConfig":
        """Return a copy with absolute paths under *backend_root*."""
        cfg = TrainingConfig(**{k: getattr(self, k) for k in self.__dataclass_fields__})
        cfg.checkpoint_dir = str(backend_root / self.checkpoint_dir)
        cfg.model_save_path = str(backend_root / self.model_save_path)
        cfg.scaler_save_path = str(backend_root / self.scaler_save_path)
        return cfg