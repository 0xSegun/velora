"""
Feature engineering for macroeconomic time series data.

Computes rolling averages, rate-of-change, momentum indicators,
lag features, and linear trend components to enrich the raw
economic indicators before feeding them to the TS-Transformer.
"""

from typing import List, Optional

import numpy as np
import pandas as pd


class FeatureEngineer:
    """
    Feature engineering pipeline for inflation prediction.

    Adds derived technical and statistical features to a DataFrame
    of macroeconomic indicators, increasing the information density
    available to the downstream transformer model.

    Usage:
        fe = FeatureEngineer()
        df_enriched = fe.transform(df)
    """

    def add_rolling_averages(
        self,
        df: pd.DataFrame,
        columns: List[str],
        windows: Optional[List[int]] = None,
    ) -> pd.DataFrame:
        """
        Add rolling (moving) averages for specified columns.

        Args:
            df: Input DataFrame.
            columns: Columns to compute rolling averages for.
            windows: List of window sizes (in periods). Default [3, 6, 12].

        Returns:
            DataFrame with additional rolling-average columns.
        """
        if windows is None:
            windows = [3, 6, 12]

        df = df.copy()

        for col in columns:
            if col not in df.columns:
                continue
            for w in windows:
                col_name = f"{col}_ma{w}"
                df[col_name] = (
                    df[col]
                    .rolling(window=w, min_periods=1)
                    .mean()
                )

        return df

    def add_rate_of_change(
        self,
        df: pd.DataFrame,
        columns: List[str],
    ) -> pd.DataFrame:
        """
        Add period-over-period rate of change (percentage change).

        Args:
            df: Input DataFrame.
            columns: Columns to compute RoC for.

        Returns:
            DataFrame with additional RoC columns.
        """
        df = df.copy()

        for col in columns:
            if col not in df.columns:
                continue
            col_name = f"{col}_roc"
            df[col_name] = df[col].pct_change().fillna(0)

        return df

    def add_momentum(
        self,
        df: pd.DataFrame,
        columns: List[str],
        period: int = 12,
    ) -> pd.DataFrame:
        """
        Add momentum indicators (current value minus value N periods ago).

        Momentum captures the speed and direction of change in an indicator,
        which is especially useful for detecting inflation acceleration.

        Args:
            df: Input DataFrame.
            columns: Columns to compute momentum for.
            period: Lookback period for momentum calculation.

        Returns:
            DataFrame with additional momentum columns.
        """
        df = df.copy()

        for col in columns:
            if col not in df.columns:
                continue
            col_name = f"{col}_momentum{period}"
            df[col_name] = df[col] - df[col].shift(period)
            df[col_name] = df[col_name].fillna(0)

        return df

    def add_lag_features(
        self,
        df: pd.DataFrame,
        columns: List[str],
        lags: Optional[List[int]] = None,
    ) -> pd.DataFrame:
        """
        Add lagged values of specified columns.

        Lag features let the model explicitly see prior values without
        relying solely on the transformer's sequential attention.

        Args:
            df: Input DataFrame.
            columns: Columns to create lag features for.
            lags: List of lag periods. Default [1, 3, 6].

        Returns:
            DataFrame with additional lag columns.
        """
        if lags is None:
            lags = [1, 3, 6]

        df = df.copy()

        for col in columns:
            if col not in df.columns:
                continue
            for lag in lags:
                col_name = f"{col}_lag{lag}"
                df[col_name] = df[col].shift(lag).fillna(method="bfill").fillna(0)

        return df

    def add_trend(
        self,
        df: pd.DataFrame,
        column: str,
    ) -> pd.DataFrame:
        """
        Add a linear trend component for a given column.

        Fits a simple linear regression (y = a*t + b) on the column
        and adds both the trend line and the de-trended residual.

        Args:
            df: Input DataFrame.
            column: Column to compute the trend for.

        Returns:
            DataFrame with '{column}_trend' and '{column}_detrended' columns.
        """
        df = df.copy()

        if column not in df.columns:
            return df

        y = df[column].values.astype(np.float64)
        t = np.arange(len(y), dtype=np.float64)

        # Handle edge case of constant series
        if np.std(y) == 0:
            df[f"{column}_trend"] = y
            df[f"{column}_detrended"] = 0.0
            return df

        # Least-squares linear fit
        coeffs = np.polyfit(t, y, 1)
        trend_line = np.polyval(coeffs, t)

        df[f"{column}_trend"] = trend_line
        df[f"{column}_detrended"] = y - trend_line

        return df

    def transform(
        self,
        df: pd.DataFrame,
        target_columns: Optional[List[str]] = None,
    ) -> pd.DataFrame:
        """
        Apply the full feature-engineering pipeline.

        Sequentially adds rolling averages, rate-of-change, momentum,
        lag features, and a linear trend for the primary target.

        Args:
            df: Raw macroeconomic DataFrame.
            target_columns: Columns to engineer features for.
                Default uses all numeric columns.

        Returns:
            Enriched DataFrame ready for preprocessing/normalization.
        """
        df = df.copy()

        if target_columns is None:
            target_columns = df.select_dtypes(include=[np.number]).columns.tolist()

        # Rolling averages
        df = self.add_rolling_averages(df, target_columns, windows=[3, 6, 12])

        # Rate of change
        df = self.add_rate_of_change(df, target_columns)

        # Momentum
        df = self.add_momentum(df, target_columns, period=12)

        # Lag features
        df = self.add_lag_features(df, target_columns, lags=[1, 3, 6])

        # Trend for the first target column (typically CPI / inflation)
        if len(target_columns) > 0:
            df = self.add_trend(df, target_columns[0])

        # Drop any remaining NaN rows introduced by rolling / shift operations
        df = df.fillna(0)

        return df
