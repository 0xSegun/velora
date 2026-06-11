"""
Training configuration dataclass for the TS-Transformer model.

Centralizes all hyperparameters, paths, and training settings
into a single, type-safe configuration object.
"""

from dataclasses import dataclass, field


@dataclass
class TrainingConfig:
    """
    Configuration for TS-Transformer training.

    Attributes:
        batch_size: Mini-batch size for training/validation.
        learning_rate: Initial learning rate for AdamW optimizer.
        num_epochs: Maximum number of training epochs.
        early_stopping_patience: Epochs without improvement before stopping.
        window_size: Number of historical time steps per input sequence.
        forecast_horizon: Number of future time steps to predict.
        n_features: Number of input features per time step.
        d_model: Transformer model dimension.
        nhead: Number of attention heads.
        num_layers: Number of transformer encoder layers.
        dim_feedforward: Inner dimension of the feed-forward network.
        dropout: Dropout rate throughout the model.
        weight_decay: L2 regularization weight for AdamW.
        scheduler: Learning rate scheduler type ('cosine' or 'step').
        gradient_clip: Maximum gradient norm for clipping.
        model_save_path: Path to save the best model checkpoint.
        scaler_save_path: Path to save the fitted data scaler.
    """

    # Training
    batch_size: int = 32
    learning_rate: float = 1e-4
    num_epochs: int = 100
    early_stopping_patience: int = 10

    # Data
    window_size: int = 24
    forecast_horizon: int = 6
    n_features: int = 8

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

    # Paths
    model_save_path: str = "models/best_model.pt"
    scaler_save_path: str = "models/scaler.pkl"
