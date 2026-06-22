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

from ai.training.features import enrich_dataframe, get_training_feature_cols

# Core macro features plus autoregressive inflation signals
TRAINING_FEATURE_COLS = get_training_feature_cols()

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
        raw = _upsample_to_monthly(raw)

    if raw.empty:
        return None

    raw = _normalize_dataframe(raw)
    raw = enrich_dataframe(preprocessor.handle_missing(raw))
    return raw


def _upsample_to_monthly(df: pd.DataFrame) -> pd.DataFrame:
    """Interpolate sparse macro series to monthly frequency for sequence building."""
    if "date" not in df.columns or len(df) < 4:
        return df

    work = df.copy()
    work["date"] = pd.to_datetime(work["date"])
    work = work.sort_values("date").set_index("date")
    numeric = work.select_dtypes(include=[np.number]).columns.tolist()
    monthly = work[numeric].resample("MS").interpolate(method="linear")
    monthly = monthly.reset_index()
    for col in df.columns:
        if col not in monthly.columns and col != "date":
            monthly[col] = df[col].iloc[0]
    return monthly


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
    processed = enrich_dataframe(preprocessor.handle_missing(raw))
    if fred_df is not None:
        from app.services.fred_service import merge_fred_with_dataset

        processed = merge_fred_with_dataset(processed, fred_df, feature_config)
    return processed


def prepare_datasets(
    df: pd.DataFrame,
    config: TrainingConfig,
) -> tuple[InflationDataset, InflationDataset, InflationDataset, DataPreprocessor]:
    """Build train / val / test datasets and fitted preprocessor."""
    if config.panel_training:
        return _prepare_panel_datasets(config)
    preprocessor = DataPreprocessor(
        window_size=config.window_size,
        forecast_horizon=config.forecast_horizon,
    )
    feature_cols = [c for c in TRAINING_FEATURE_COLS if c in df.columns]
    preprocessor.feature_columns = feature_cols
    config.n_features = len(feature_cols) + EVENT_FEATURE_DIM
    preprocessor.residual_mode = config.residual_mode

    inflation = df["inflation_rate"].values.astype(np.float64)
    n_rows = len(df)
    event_zeros = np.zeros((n_rows, EVENT_FEATURE_DIM), dtype=np.float32)

    # Determine split sizes from raw timeline before scaling
    total_length = n_rows - config.window_size - config.forecast_horizon + 1
    test_size = max(1, int(total_length * config.test_ratio))
    val_size = max(1, int(total_length * config.val_ratio))
    train_end = total_length - test_size - val_size
    train_feature_end = train_end + config.window_size

    train_rows = df[feature_cols].iloc[:train_feature_end].copy()
    _, preprocessor.feature_scaler = preprocessor.normalize(train_rows, feature_cols)
    scaled_features = preprocessor.feature_scaler.transform(df[feature_cols])
    feature_matrix = np.hstack(
        [scaled_features.astype(np.float32), event_zeros]
    )

    X, y_abs, baselines = _build_sequence_arrays(
        feature_matrix=feature_matrix,
        inflation=inflation,
        window_size=config.window_size,
        forecast_horizon=config.forecast_horizon,
    )

    y_model = (y_abs - baselines[:, None]) if config.residual_mode else y_abs.copy()
    train_targets = y_model[:train_end].reshape(-1, 1)
    preprocessor.fit_target_scaler(train_targets)
    y_scaled = preprocessor.transform_target(y_model)

    return (
        InflationDataset(X[:train_end], y_scaled[:train_end], baselines[:train_end]),
        InflationDataset(
            X[train_end : train_end + val_size],
            y_scaled[train_end : train_end + val_size],
            baselines[train_end : train_end + val_size],
        ),
        InflationDataset(
            X[train_end + val_size :],
            y_scaled[train_end + val_size :],
            baselines[train_end + val_size :],
            absolute_targets=y_abs[train_end + val_size :],
        ),
        preprocessor,
    )


def _prepare_panel_datasets(
    config: TrainingConfig,
) -> tuple[InflationDataset, InflationDataset, InflationDataset, DataPreprocessor]:
    """Build pooled train/val/test sets across supported countries."""
    preprocessor = DataPreprocessor(
        window_size=config.window_size,
        forecast_horizon=config.forecast_horizon,
    )
    reference = load_country_dataframe("NG")
    if reference is None:
        raise ValueError("Nigeria reference data unavailable for panel training")

    feature_cols = [c for c in TRAINING_FEATURE_COLS if c in reference.columns]
    preprocessor.feature_columns = feature_cols
    config.n_features = len(feature_cols) + EVENT_FEATURE_DIM
    preprocessor.residual_mode = config.residual_mode

    country_frames: list[tuple[str, pd.DataFrame, int, int, int]] = []
    feature_train_frames: list[pd.DataFrame] = []

    for code in config.panel_countries:
        df = load_country_dataframe(code)
        if df is None:
            continue
        cols = [c for c in feature_cols if c in df.columns]
        n_rows = len(df)
        total_length = n_rows - config.window_size - config.forecast_horizon + 1
        if total_length < 12:
            continue
        test_size = max(1, int(total_length * config.test_ratio))
        val_size = max(1, int(total_length * config.val_ratio))
        train_end = total_length - test_size - val_size
        country_frames.append((code, df, train_end, val_size, test_size))
        feature_train_frames.append(df[cols].iloc[: train_end + config.window_size])

    if not country_frames:
        raise ValueError("No panel training data available")

    panel_train_features = pd.concat(feature_train_frames, ignore_index=True)
    _, preprocessor.feature_scaler = preprocessor.normalize(panel_train_features, feature_cols)

    train_X, train_y, train_b = [], [], []
    val_X, val_y, val_b = [], [], []
    test_X, test_y, test_b, test_abs = [], [], [], []

    for _code, df, train_end, val_size, _test_size in country_frames:
        cols = [c for c in feature_cols if c in df.columns]
        n_rows = len(df)
        event_zeros = np.zeros((n_rows, EVENT_FEATURE_DIM), dtype=np.float32)
        scaled = preprocessor.feature_scaler.transform(df[cols])
        matrix = np.hstack([scaled.astype(np.float32), event_zeros])
        inflation = df["inflation_rate"].values.astype(np.float64)
        X, y_abs, baselines = _build_sequence_arrays(
            feature_matrix=matrix,
            inflation=inflation,
            window_size=config.window_size,
            forecast_horizon=config.forecast_horizon,
        )
        y_model = (y_abs - baselines[:, None]) if config.residual_mode else y_abs.copy()

        train_X.append(X[:train_end])
        train_y.append(y_model[:train_end])
        train_b.append(baselines[:train_end])
        val_X.append(X[train_end : train_end + val_size])
        val_y.append(y_model[train_end : train_end + val_size])
        val_b.append(baselines[train_end : train_end + val_size])
        test_X.append(X[train_end + val_size :])
        test_y.append(y_model[train_end + val_size :])
        test_b.append(baselines[train_end + val_size :])
        test_abs.append(y_abs[train_end + val_size :])

    X_train = np.concatenate(train_X, axis=0)
    y_train = np.concatenate(train_y, axis=0)
    b_train = np.concatenate(train_b, axis=0)
    X_val = np.concatenate(val_X, axis=0)
    y_val = np.concatenate(val_y, axis=0)
    b_val = np.concatenate(val_b, axis=0)
    X_test = np.concatenate(test_X, axis=0)
    y_test = np.concatenate(test_y, axis=0)
    b_test = np.concatenate(test_b, axis=0)
    y_abs_test = np.concatenate(test_abs, axis=0)

    preprocessor.fit_target_scaler(y_train.reshape(-1, 1))
    return (
        InflationDataset(X_train, preprocessor.transform_target(y_train), b_train),
        InflationDataset(X_val, preprocessor.transform_target(y_val), b_val),
        InflationDataset(
            X_test,
            preprocessor.transform_target(y_test),
            b_test,
            absolute_targets=y_abs_test,
        ),
        preprocessor,
    )


def _build_sequence_arrays(
    df: pd.DataFrame | None = None,
    feature_cols: list[str] | None = None,
    inflation: np.ndarray | None = None,
    window_size: int = 24,
    forecast_horizon: int = 1,
    event_zeros: np.ndarray | None = None,
    *,
    feature_matrix: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Create model inputs, absolute targets, and persistence baselines."""
    if feature_matrix is None:
        if df is None or feature_cols is None or inflation is None:
            raise ValueError("feature_matrix or (df, feature_cols, inflation) required")
        matrix = np.hstack(
            [df[feature_cols].values.astype(np.float32), event_zeros]
        )
        inflation_series = inflation
    else:
        matrix = feature_matrix
        if inflation is None:
            raise ValueError("inflation required when using feature_matrix")
        inflation_series = inflation

    total_length = len(matrix) - window_size - forecast_horizon + 1
    if total_length <= 0:
        raise ValueError("Insufficient rows for sequence construction")

    X: list[np.ndarray] = []
    y_abs: list[np.ndarray] = []
    baselines: list[float] = []

    for i in range(total_length):
        X.append(matrix[i : i + window_size])
        y_abs.append(
            inflation_series[i + window_size : i + window_size + forecast_horizon]
        )
        baselines.append(float(inflation_series[i + window_size - 1]))

    return (
        np.array(X, dtype=np.float32),
        np.array(y_abs, dtype=np.float32),
        np.array(baselines, dtype=np.float32),
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

    # Save scalers alongside checkpoint (metrics appended after evaluation)
    scaler_dir = Path(cfg.checkpoint_dir)
    preprocessor.save_scaler(preprocessor.feature_scaler, cfg.scaler_save_path)

    # Evaluate on held-out test set
    best_ckpt = Path(cfg.checkpoint_dir) / "best_model.pt"
    if best_ckpt.exists():
        trainer.load_checkpoint(best_ckpt)

    evaluator = ModelEvaluator(trainer.model, preprocessor=preprocessor)
    metrics = evaluator.evaluate(test_ds, batch_size=cfg.batch_size)

    accuracy_pct = max(0.0, 100.0 - metrics.mape)
    elapsed = time.time() - t0

    preprocessor.evaluation_metrics = {
        "accuracy_pct": round(accuracy_pct, 2),
        "mape": round(metrics.mape, 2),
        "rmse": round(metrics.rmse, 4),
        "mae": round(metrics.mae, 4),
        "r2_score": round(metrics.r2, 4),
        "n_samples": metrics.n_samples,
    }
    preprocessor.save_scalers(str(scaler_dir))

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

    try:
        from app.services.training_behaviour_service import save_training_history

        save_training_history(history)
    except Exception as exc:
        logger.warning("Could not persist training history: %s", exc)

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