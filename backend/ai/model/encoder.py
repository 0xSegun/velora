"""
Transformer encoder layers and stacked encoder for time series.

Implements the standard transformer encoder architecture with
pre-norm residual connections, GELU activations, and configurable
depth for macroeconomic time series processing.
"""

import torch
import torch.nn as nn
from .attention import MultiHeadAttention
from typing import Optional


class TransformerEncoderLayer(nn.Module):
    """
    Single transformer encoder layer with multi-head attention and FFN.

    Architecture per layer:
        1. Multi-Head Self-Attention + residual + LayerNorm
        2. Feed-Forward Network (Linear → GELU → Dropout → Linear → Dropout) + residual + LayerNorm

    Args:
        d_model: Dimensionality of the model.
        nhead: Number of attention heads.
        dim_feedforward: Inner dimension of the feed-forward network.
        dropout: Dropout rate.
    """

    def __init__(
        self,
        d_model: int,
        nhead: int,
        dim_feedforward: int = 512,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()

        # Multi-head self-attention
        self.self_attn = MultiHeadAttention(d_model, nhead, dropout)

        # Position-wise feed-forward network
        self.ffn = nn.Sequential(
            nn.Linear(d_model, dim_feedforward),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(dim_feedforward, d_model),
            nn.Dropout(dropout),
        )

        # Layer normalization
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)

        # Residual dropout
        self.dropout = nn.Dropout(dropout)

    def forward(
        self, src: torch.Tensor, mask: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        Forward pass through one encoder layer.

        Args:
            src: Input tensor (batch, seq_len, d_model).
            mask: Optional attention mask.

        Returns:
            Output tensor (batch, seq_len, d_model).
        """
        # Self-attention sub-layer with residual connection
        attn_output, _ = self.self_attn(src, src, src, mask)
        src = self.norm1(src + self.dropout(attn_output))

        # Feed-forward sub-layer with residual connection
        ffn_output = self.ffn(src)
        src = self.norm2(src + ffn_output)

        return src


class TransformerEncoder(nn.Module):
    """
    Stack of N transformer encoder layers with final layer normalization.

    Args:
        d_model: Dimensionality of the model.
        nhead: Number of attention heads.
        num_layers: Number of stacked encoder layers.
        dim_feedforward: Inner dimension of each layer's FFN.
        dropout: Dropout rate.
    """

    def __init__(
        self,
        d_model: int,
        nhead: int,
        num_layers: int,
        dim_feedforward: int = 512,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()

        self.layers = nn.ModuleList([
            TransformerEncoderLayer(d_model, nhead, dim_feedforward, dropout)
            for _ in range(num_layers)
        ])

        # Final layer norm after all encoder layers
        self.norm = nn.LayerNorm(d_model)

    def forward(
        self, src: torch.Tensor, mask: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        Forward pass through the full encoder stack.

        Args:
            src: Input tensor (batch, seq_len, d_model).
            mask: Optional attention mask.

        Returns:
            Encoded output tensor (batch, seq_len, d_model).
        """
        for layer in self.layers:
            src = layer(src, mask)

        return self.norm(src)
