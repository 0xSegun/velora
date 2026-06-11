"""
TS-Transformer: Time-Series Transformer for Inflation/Deflation Prediction.

End-to-end model that processes multivariate macroeconomic features
through a transformer encoder and produces multi-horizon inflation
forecasts along with deflation probability, trend direction,
confidence scores, and risk levels.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from .positional import PositionalEncoding
from .encoder import TransformerEncoder
from typing import Dict, Optional


class TSTransformer(nn.Module):
    """
    Time-Series Transformer for Inflation/Deflation Prediction.

    Input features (default 8):
        CPI, GDP Growth, Interest Rate, Exchange Rate,
        Oil Price, Gov Spending, Employment Rate, Money Supply

    Output heads:
        - inflation_rate:    (batch, forecast_horizon) — predicted rates
        - deflation_prob:    (batch, forecast_horizon) — deflation probability per step
        - trend_direction:   (batch, 3) — logits for [up, stable, down]
        - confidence_score:  (batch,) — model confidence 0-1
        - risk_level:        (batch,) — risk score 0-100

    Args:
        n_features: Number of input features per time step.
        d_model: Transformer model dimension.
        nhead: Number of attention heads.
        num_layers: Number of encoder layers.
        dim_feedforward: FFN inner dimension.
        dropout: Dropout rate.
        forecast_horizon: Number of future time steps to predict.
    """

    def __init__(
        self,
        n_features: int = 8,
        d_model: int = 128,
        nhead: int = 8,
        num_layers: int = 4,
        dim_feedforward: int = 512,
        dropout: float = 0.1,
        forecast_horizon: int = 6,
    ) -> None:
        super().__init__()

        self.n_features = n_features
        self.d_model = d_model
        self.forecast_horizon = forecast_horizon

        # ── Input projection: raw features → model dimension ──
        self.input_projection = nn.Sequential(
            nn.Linear(n_features, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # ── Positional encoding ──
        self.pos_encoder = PositionalEncoding(d_model, dropout=dropout)

        # ── Transformer encoder stack ──
        self.encoder = TransformerEncoder(
            d_model, nhead, num_layers, dim_feedforward, dropout
        )

        # ── Output heads ──

        # Inflation rate prediction (regression)
        self.inflation_head = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, forecast_horizon),
        )

        # Deflation probability (binary per time step)
        self.deflation_head = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, forecast_horizon),
            nn.Sigmoid(),
        )

        # Trend direction (3-class classification: up / stable / down)
        self.trend_head = nn.Sequential(
            nn.Linear(d_model, d_model // 4),
            nn.GELU(),
            nn.Linear(d_model // 4, 3),
        )

        # Confidence score (0-1 scalar)
        self.confidence_head = nn.Sequential(
            nn.Linear(d_model, d_model // 4),
            nn.GELU(),
            nn.Linear(d_model // 4, 1),
            nn.Sigmoid(),
        )

        # Risk level (0-100 scalar)
        self.risk_head = nn.Sequential(
            nn.Linear(d_model, d_model // 4),
            nn.GELU(),
            nn.Linear(d_model // 4, 1),
            nn.Sigmoid(),
        )

        # Initialize weights
        self._init_weights()

    def _init_weights(self) -> None:
        """Xavier-uniform initialization for all multi-dimensional parameters."""
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def forward(
        self,
        x: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass through the full TS-Transformer.

        Args:
            x: Input tensor of shape (batch, seq_len, n_features).
            mask: Optional attention mask.

        Returns:
            Dictionary of prediction tensors:
                - inflation_rate:   (batch, forecast_horizon)
                - deflation_prob:   (batch, forecast_horizon)
                - trend_direction:  (batch, 3)
                - confidence_score: (batch,)
                - risk_level:       (batch,) scaled 0–100
        """
        # Project input features to model dimension
        x = self.input_projection(x)  # (batch, seq_len, d_model)

        # Add positional encoding
        x = self.pos_encoder(x)

        # Encode with transformer
        encoded = self.encoder(x, mask)  # (batch, seq_len, d_model)

        # Global average pooling over the sequence dimension
        pooled = encoded.mean(dim=1)  # (batch, d_model)

        # Produce outputs from each head
        return {
            'inflation_rate': self.inflation_head(pooled),
            'deflation_prob': self.deflation_head(pooled),
            'trend_direction': self.trend_head(pooled),
            'confidence_score': self.confidence_head(pooled).squeeze(-1),
            'risk_level': self.risk_head(pooled).squeeze(-1) * 100,
        }
