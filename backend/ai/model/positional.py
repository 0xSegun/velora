"""
Sinusoidal positional encoding for time series transformer models.

Provides temporal position information to the transformer encoder
since attention mechanisms are permutation-invariant by default.
"""

import torch
import torch.nn as nn
import math


class PositionalEncoding(nn.Module):
    """
    Sinusoidal positional encoding for time series data.

    Uses sine and cosine functions of different frequencies to encode
    the position of each time step in the input sequence, allowing
    the transformer to learn temporal dependencies.

    Args:
        d_model: Dimensionality of the model embeddings.
        max_len: Maximum sequence length supported.
        dropout: Dropout rate applied after adding positional encoding.
    """

    def __init__(self, d_model: int, max_len: int = 5000, dropout: float = 0.1) -> None:
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        # Pre-compute the positional encoding matrix
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )

        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # (1, max_len, d_model)

        # Register as buffer (not a parameter, but moves with the model)
        self.register_buffer('pe', pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Add positional encoding to input embeddings.

        Args:
            x: Input tensor of shape (batch, seq_len, d_model).

        Returns:
            Positionally-encoded tensor of the same shape.
        """
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)
