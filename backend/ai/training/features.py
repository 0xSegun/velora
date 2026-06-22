"""
Feature engineering for TS-Transformer training.
"""

from __future__ import annotations

import pandas as pd

from ai.pipeline.preprocess import DEFAULT_FEATURE_COLS

ENGINEERED_COLS = [
    "inflation_lag1",
    "inflation_lag3",
    "inflation_lag6",
    "inflation_lag12",
    "inflation_ma3",
    "inflation_ma6",
    "inflation_momentum",
]


def get_training_feature_cols() -> list[str]:
    return [*DEFAULT_FEATURE_COLS, "inflation_rate", *ENGINEERED_COLS]


def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Add autoregressive inflation features."""
    out = df.copy()
    if "inflation_rate" not in out.columns:
        return out

    ir = out["inflation_rate"].astype(float)
    out["inflation_lag1"] = ir.shift(1)
    out["inflation_lag3"] = ir.shift(3)
    out["inflation_lag6"] = ir.shift(6)
    out["inflation_lag12"] = ir.shift(12)
    out["inflation_ma3"] = ir.rolling(3, min_periods=1).mean()
    out["inflation_ma6"] = ir.rolling(6, min_periods=1).mean()
    out["inflation_momentum"] = ir.diff()

    numeric = out.select_dtypes(include="number").columns
    out[numeric] = out[numeric].bfill().ffill().fillna(0)
    return out