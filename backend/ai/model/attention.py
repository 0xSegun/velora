"""
Multi-Head Self-Attention mechanism for time series transformers.

Implements scaled dot-product attention with multiple heads to capture
different aspects of temporal relationships in macroeconomic data.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math
from typing import Optional, Tuple


class MultiHeadAttention(nn.Module):
    """
    Multi-Head Self-Attention mechanism for time series.

    Splits the input into multiple attention heads, each computing
    scaled dot-product attention independently, then concatenates
    and projects the results.

    Args:
        d_model: Dimensionality of the model.
        nhead: Number of attention heads.
        dropout: Dropout rate for attention weights.
    """

    def __init__(self, d_model: int, nhead: int, dropout: float = 0.1) -> None:
        super().__init__()
        assert d_model % nhead == 0, "d_model must be divisible by nhead"

        self.d_model = d_model
        self.nhead = nhead
        self.d_k = d_model // nhead

        # Linear projections for queries, keys, values, and output
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

        self.dropout = nn.Dropout(dropout)

        # Store attention weights for visualization / interpretability
        self.attn_weights: Optional[torch.Tensor] = None

    def forward(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Compute multi-head attention.

        Args:
            query: Query tensor (batch, seq_len_q, d_model).
            key:   Key tensor   (batch, seq_len_k, d_model).
            value: Value tensor (batch, seq_len_v, d_model).
            mask:  Optional attention mask (broadcastable to attention shape).

        Returns:
            Tuple of (output, attention_weights).
            output: (batch, seq_len_q, d_model)
            attention_weights: (batch, nhead, seq_len_q, seq_len_k)
        """
        batch_size = query.size(0)

        # Project and reshape: (batch, seq, d_model) -> (batch, nhead, seq, d_k)
        Q = self.W_q(query).view(batch_size, -1, self.nhead, self.d_k).transpose(1, 2)
        K = self.W_k(key).view(batch_size, -1, self.nhead, self.d_k).transpose(1, 2)
        V = self.W_v(value).view(batch_size, -1, self.nhead, self.d_k).transpose(1, 2)

        # Scaled dot-product attention
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(self.d_k)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        attn = F.softmax(scores, dim=-1)
        attn = self.dropout(attn)

        # Store for interpretability (detached from computation graph)
        self.attn_weights = attn.detach()

        # Weighted sum of values
        context = torch.matmul(attn, V)

        # Reshape back: (batch, nhead, seq, d_k) -> (batch, seq, d_model)
        context = context.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)

        # Final linear projection
        output = self.W_o(context)

        return output, attn
