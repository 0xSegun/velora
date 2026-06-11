"""
PyTorch Dataset for inflation time series data.

Wraps numpy arrays of features and targets into a Dataset
compatible with PyTorch DataLoaders for batch training.
"""

import numpy as np
import torch
from torch.utils.data import Dataset
from typing import Tuple


class InflationDataset(Dataset):
    """
    PyTorch Dataset for inflation prediction sequences.

    Converts pre-processed numpy feature/target arrays into
    float tensors and provides indexed access for DataLoader batching.

    Args:
        features: Input feature array of shape (num_samples, window_size, n_features).
        targets: Target array of shape (num_samples, forecast_horizon).
    """

    def __init__(self, features: np.ndarray, targets: np.ndarray) -> None:
        if len(features) != len(targets):
            raise ValueError(
                f"Features ({len(features)}) and targets ({len(targets)}) "
                "must have the same number of samples."
            )

        self.features = torch.FloatTensor(features)
        self.targets = torch.FloatTensor(targets)

    def __len__(self) -> int:
        """Return the total number of samples."""
        return len(self.features)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Return a single (feature, target) pair.

        Args:
            idx: Sample index.

        Returns:
            Tuple of (features_tensor, targets_tensor).
        """
        return self.features[idx], self.targets[idx]
