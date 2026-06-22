"""
End-to-end TS-Transformer training pipeline.

Loads economic CSV data, prepares sequences, trains the model,
evaluates on held-out data, and persists checkpoints + scalers.
"""

from __future__ import annotations

import logging
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd

from ai.model.transformer import TSTransformer
from ai.pipeline.dataset import InflationDataset
from ai.pipeline.preprocess import (
    DEFAULT_FEATURE_COLS,
    EVENT_FEATURE_DIM,
    DataPreprocessor,
)
from ai.training.config import TrainingConfig
from ai.training.evaluate import ModelEvaluator
from ai.training.trainer import Trainer

logger = logging.getLogger(__name__)

# Core macro features plus lagged inflation (strongest predictor)
TRAINING_FEATURE_COLS = [*DEFAULT_FEATURE_COLS, "inflation_rate"]

# CSV column aliases → model feature names
_COLUMN_ALIASES: dict[str, str] = {
    "exchange_rate_usd": "exchange_rate",
    "oil_price_brent": "oil_price",
    "gov_spending_bn_ngn": "gov_spending",
    "money_supply_m2_bn_ngn": "money_supply",
}


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Rename CSV columns and ensure required feature columns exist."""
    df = df.copy()
    df = df.rename(columns=_COLUMN_ALIASES)

    for col in DEFAULT_FEATURE_COLS:
        if col not in df.columns:
            if col == "exchange_rate":
                df[col] = df.get("exchange_rate", 400.0)
            elif col == "employment_rate" and "unemployment_rate" in df.columns:
                df[col] = 100.0 - df["unemployment_rate"]
            else:
                df[col] = 0.0

    if "inflation_rate" not in df.columns:
        # Derive approximate inflation from CPI if missing
        if "cpi" in df.columns:
            df["inflation_rate"] = df["cpi"].pct_change().fillna(0) * 100 * 12
        else:
            raise ValueError("Dataset must include inflation_rate or cpi column")

    return df


# Default macro values for countries with partial CSV coverage
_COUNTRY_DEFAULTS: dict[str, dict[str, float]] = {
    "NG": {"oil_price": 80.0, "gov_spending": 1200.0, "employment_rate": 75.0, "money_supply": 8000.0},
    "US": {"oil_price": 75.0, "gov_spending": 500.0, "employment_rate": 96.0, "money_supply": 21000.0},
    "GB": {"oil_price": 78.0, "gov_spending": 400.0, "employment_rate": 95.0, "money_supply": 3200.0},
    "GH": {"oil_price": 82.0, "gov_spending": 80.0, "employment_rate": 88.0, "money_supply": 120.0},
    "ZA": {"oil_price": 76.0, "gov_spending": 200.0, "employment_rate": 72.0, "money_supply": 4500.0},
}


def load_country_dataframe(country_code: str) -> pd.DataFrame | None:
    """Load normalized monthly/quarterly data for a single country."""
    backend = _backend_root()
    code = country_code.upper()
    preprocessor = DataPreprocessor()

    if code == "NG":
        path = backend / "data" / "sample_economic_data.csv"
        if not path.exists():
            from data.generate_data import generate_economic_data
            generate_economic_data()
        raw = preprocessor.load_csv(str(path))
        raw = raw[raw["country_code"].str.upper() == code].copy()
    else:
        global_path = backend / "data" / "sample_global_data.csv"
        if not global_path.exists():
            from data.generate_data import generate_global_data
            generate_global_data()
        raw = preprocessor.load_csv(str(global_path))
        raw = raw[raw["country_code"].str.upper() == code].copy()
        defaults = _COUNTRY_DEFAULTS.get(code, _COUNTRY_DEFAULTS["US"])
        for col, val in defaults.items():
            if col not in raw.columns:
                raw[col] = val

    if raw.empty:
        return None

    raw = _normalize_dataframe(raw)
    return preprocessor.handle_missing(raw)


def load_training_dataframe(
    csv_path: str | Path | None = None,
    df: pd.DataFrame | None = None,
    country_code: str | None = None,
    fred_df: pd.DataFrame | None = None,
    feature_config: dict | None = None,
) -> pd.DataFrame:
    """Load and normalize training data from CSV or an existing DataFrame."""
    if country_code and df is None and csv_path is None:
        loaded = load_country_dataframe(country_code)
        if loaded is None:
            raise FileNotFoundError(f"No training data for country {country_code}")
        return loaded

    preprocessor = DataPreprocessor()
    if df is not None:
        raw = df.copy()
    else:
        path = Path(csv_path) if csv_path else _backend_root() / "data" / "sample_economic_data.csv"
        if not path.exists():
            from data.generate_data import generate_economic_data
            generate_economic_data()
        raw = preprocessor.load_csv(str(path))

    raw = _normalize_dataframe(raw)
    processed = preprocessor.handle_missing(raw)
    if fred_df is not None:
        from app.services.fred_service import merge_fred_with_dataset

        processed = merge_fred_with_dataset(processed, fred_df, feature_config)
    return processed


def prepare_datasets(
    df: pd.DataFrame,
    config: TrainingConfig,
) -> tuple[InflationDataset, InflationDataset, InflationDataset, DataPreprocessor]:
    """
    Build train / val / test datasets and fitted preprocessor.

    Returns
    -------
    train_dataset, val_dataset, test_dataset, preprocessor
    """
    preprocessor = DataPreprocessor(
        window_size=config.window_size,
        forecast_horizon=config.forecast_horizon,
    )
    preprocessor.feature_columns = TRAINING_FEATURE_COLS

    feature_df = df[TRAINING_FEATURE_COLS].copy()
    feature_df, preprocessor.feature_scaler = preprocessor.normalize(
        feature_df, TRAINING_FEATURE_COLS
    )

    inflation = df["inflation_rate"].values.astype(np.float64)
    preprocessor.fit_target_scaler(inflation.reshape(-1, 1))

    # Append zero event features for alignment with inference (8 + 4 = 12)
    n_rows = len(feature_df)
    event_zeros = np.zeros((n_rows, EVENT_FEATURE_DIM), dtype=np.float32)
    feature_matrix = np.hstack(
        [feature_df.values.astype(np.float32), event_zeros]
    )

    X, y = preprocessor.create_sequences_from_features(
        feature_matrix,
        inflation,
        window_size=config.window_size,
        forecast_horizon=config.forecast_horizon,
    )
    y = preprocessor.transform_target(y)

    # Temporal split: train | val | test
    n = len(X)
    test_size = max(1, int(n * config.test_ratio))
    val_size = max(1, int(n * config.val_ratio))
    train_end = n - test_size - val_size

    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end : train_end + val_size], y[train_end : train_end + val_size]
    X_test, y_test = X[train_end + val_size :], y[train_end + val_size :]

    return (
        InflationDataset(X_train, y_train),
        InflationDataset(X_val, y_val),
        InflationDataset(X_test, y_test),
        preprocessor,
    )


def run_training(
    config: TrainingConfig | None = None,
    csv_path: str | Path | None = None,
    df: pd.DataFrame | None = None,
    fred_df: pd.DataFrame | None = None,
    feature_config: dict | None = None,
) -> dict[str, Any]:
    """
    Train TS-Transformer and return evaluation metrics.

    Persists best checkpoint to ``config.model_save_path`` and scalers
    to the models directory.
    """
    backend_root = _backend_root()
    base_config = config or TrainingConfig()
    cfg = base_config.resolved_paths(backend_root)
    cfg.ensure_dirs()

    t0 = time.time()
    df = load_training_dataframe(
        csv_path=csv_path,
        df=df,
        fred_df=fred_df,
        feature_config=feature_config,
    )
    train_ds, val_ds, test_ds, preprocessor = prepare_datasets(df, cfg)

    model = TSTransformer(
        n_features=cfg.n_features,
        d_model=cfg.d_model,
        nhead=cfg.nhead,
        num_layers=cfg.num_layers,
        dim_feedforward=cfg.dim_feedforward,
        dropout=cfg.dropout,
        forecast_horizon=cfg.forecast_horizon,
    )

    trainer = Trainer(model, cfg)
    history = trainer.train(train_ds, val_ds)

    # Save scalers alongside checkpoint
    scaler_dir = Path(cfg.checkpoint_dir)
    preprocessor.save_scalers(str(scaler_dir))
    preprocessor.save_scaler(preprocessor.feature_scaler, cfg.scaler_save_path)

    # Evaluate on held-out test set
    best_ckpt = Path(cfg.checkpoint_dir) / "best_model.pt"
    if best_ckpt.exists():
        trainer.load_checkpoint(best_ckpt)

    evaluator = ModelEvaluator(trainer.model, preprocessor=preprocessor)
    metrics = evaluator.evaluate(test_ds, batch_size=cfg.batch_size)

    accuracy_pct = max(0.0, 100.0 - metrics.mape)
    elapsed = time.time() - t0

    result = {
        "accuracy": round(accuracy_pct / 100.0, 4),
        "accuracy_pct": round(accuracy_pct, 2),
        "rmse": round(metrics.rmse, 4),
        "mae": round(metrics.mae, 4),
        "mape": round(metrics.mape, 2),
        "r2": round(metrics.r2, 4),
        "epochs_trained": len(history["train_loss"]),
        "best_epoch": trainer.best_epoch + 1,
        "best_val_loss": trainer.best_val_loss,
        "training_time_seconds": round(elapsed, 1),
        "checkpoint_path": str(best_ckpt),
        "scaler_dir": str(scaler_dir),
        "config": asdict(cfg),
        "history": history,
    }

    logger.info(
        "Training complete — accuracy=%.1f%% MAPE=%.2f%% RMSE=%.3f (%.1fs)",
        accuracy_pct,
        metrics.mape,
        metrics.rmse,
        elapsed,
    )
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    outcome = run_training()
    print(
        f"\nAccuracy: {outcome['accuracy_pct']}%  "
        f"MAPE: {outcome['mape']}%  RMSE: {outcome['rmse']}"
    )