"""
Data preprocessing pipeline for inflation prediction.

Handles CSV loading, missing value imputation, feature normalization,
sliding-window sequence creation, and train/test splitting for
time series data used by the TS-Transformer model.
"""

import os
import pickle
from typing import Tuple, List, Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

DEFAULT_FEATURE_COLS = [
    "cpi",
    "gdp_growth",
    "interest_rate",
    "exchange_rate",
    "oil_price",
    "gov_spending",
    "employment_rate",
    "money_supply",
]

EVENT_FEATURE_DIM = 4  # event_count, severity, impact, recency


class DataPreprocessor:
    """
    End-to-end data preprocessing for macroeconomic time series.

    Typical usage:
        preprocessor = DataPreprocessor()
        df = preprocessor.load_csv("data/macro.csv")
        df = preprocessor.handle_missing(df)
        df, scaler = preprocessor.normalize(df, columns=["CPI", "GDP_Growth", ...])
        X, y = preprocessor.create_sequences(df.values, window_size=24, forecast_horizon=6)
        X_train, X_test, y_train, y_test = preprocessor.train_test_split(X, y, test_ratio=0.2)
        preprocessor.save_scaler(scaler, "models/scaler.pkl")
    """

    def load_csv(self, path: str, date_column: Optional[str] = "date") -> pd.DataFrame:
        """
        Load a CSV file into a DataFrame.

        Args:
            path: File path to the CSV file.
            date_column: Name of the date column to parse, or None to skip.

        Returns:
            Loaded DataFrame sorted by date if a date column exists.
        """
        if not os.path.exists(path):
            raise FileNotFoundError(f"Data file not found: {path}")

        df = pd.read_csv(path)

        if date_column and date_column in df.columns:
            df[date_column] = pd.to_datetime(df[date_column])
            df = df.sort_values(date_column).reset_index(drop=True)

        return df

    def handle_missing(
        self,
        df: pd.DataFrame,
        method: str = "interpolate",
    ) -> pd.DataFrame:
        """
        Handle missing values in the DataFrame.

        Args:
            df: Input DataFrame.
            method: Imputation method — 'interpolate' (default), 'ffill', or 'mean'.

        Returns:
            DataFrame with missing values filled.
        """
        df = df.copy()
        numeric_cols = df.select_dtypes(include=[np.number]).columns

        if method == "interpolate":
            df[numeric_cols] = df[numeric_cols].interpolate(
                method="linear", limit_direction="both"
            )
        elif method == "ffill":
            df[numeric_cols] = df[numeric_cols].ffill().bfill()
        elif method == "mean":
            for col in numeric_cols:
                df[col] = df[col].fillna(df[col].mean())
        else:
            raise ValueError(f"Unknown imputation method: {method}")

        # Final safety: fill any remaining NaNs with 0
        df[numeric_cols] = df[numeric_cols].fillna(0)

        return df

    def normalize(
        self,
        df: pd.DataFrame,
        columns: List[str],
        scaler: Optional[MinMaxScaler] = None,
    ) -> Tuple[pd.DataFrame, MinMaxScaler]:
        """
        Normalize specified columns using MinMaxScaler.

        Args:
            df: Input DataFrame.
            columns: List of column names to normalize.
            scaler: Optional pre-fitted scaler. If None, a new scaler is fitted.

        Returns:
            Tuple of (normalized DataFrame, fitted scaler).
        """
        df = df.copy()

        if scaler is None:
            scaler = MinMaxScaler(feature_range=(0, 1))
            df[columns] = scaler.fit_transform(df[columns])
        else:
            df[columns] = scaler.transform(df[columns])

        return df, scaler

    def create_sequences(
        self,
        data: np.ndarray,
        window_size: int = 24,
        forecast_horizon: int = 6,
        target_column_index: int = 0,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sliding-window sequences for time series prediction.

        Args:
            data: 2D numpy array of shape (time_steps, n_features).
            window_size: Number of past time steps per input sequence.
            forecast_horizon: Number of future steps to predict.
            target_column_index: Column index used as the prediction target.

        Returns:
            Tuple of (X, y) where:
                X: (num_samples, window_size, n_features)
                y: (num_samples, forecast_horizon)
        """
        X: List[np.ndarray] = []
        y: List[np.ndarray] = []

        total_length = len(data) - window_size - forecast_horizon + 1

        if total_length <= 0:
            raise ValueError(
                f"Data length ({len(data)}) is too short for "
                f"window_size={window_size} + forecast_horizon={forecast_horizon}"
            )

        for i in range(total_length):
            X.append(data[i : i + window_size])
            y.append(
                data[
                    i + window_size : i + window_size + forecast_horizon,
                    target_column_index,
                ]
            )

        return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

    def train_test_split(
        self,
        X: np.ndarray,
        y: np.ndarray,
        test_ratio: float = 0.2,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Split data into training and test sets (preserving temporal order).

        Unlike sklearn's random split, this uses a simple cutoff point
        to avoid data leakage in time series forecasting.

        Args:
            X: Feature arrays.
            y: Target arrays.
            test_ratio: Fraction of data reserved for testing.

        Returns:
            Tuple of (X_train, X_test, y_train, y_test).
        """
        split_idx = int(len(X) * (1 - test_ratio))
        return X[:split_idx], X[split_idx:], y[:split_idx], y[split_idx:]

    def save_scaler(self, scaler: MinMaxScaler, path: str) -> None:
        """
        Serialize a fitted scaler to disk.

        Args:
            scaler: Fitted MinMaxScaler instance.
            path: File path to save the scaler.
        """
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(scaler, f)

    def load_scaler(self, path: str) -> MinMaxScaler:
        """
        Load a previously saved scaler from disk.

        Args:
            path: File path to the serialized scaler.

        Returns:
            Loaded MinMaxScaler instance.
        """
        if not os.path.exists(path):
            raise FileNotFoundError(f"Scaler file not found: {path}")

        with open(path, "rb") as f:
            scaler = pickle.load(f)

        if not isinstance(scaler, MinMaxScaler):
            raise TypeError(f"Expected MinMaxScaler, got {type(scaler).__name__}")

        return scaler
