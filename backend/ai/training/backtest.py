"""
Walk-forward backtest utilities for accuracy monitoring.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import torch
from torch.utils.data import DataLoader

from ai.model.transformer import TSTransformer
from ai.training.config import TrainingConfig
from ai.training.runner import (
    _backend_root,
    load_country_dataframe,
    prepare_datasets,
)

logger = logging.getLogger(__name__)

BACKTEST_MODEL_VERSION = "TS-Transformer-v3.0-backtest"
SUPPORTED_BACKTEST_COUNTRIES = ("NG", "US", "GB", "GH", "ZA")


def run_backtest_records(
    country_code: str = "NG",
    max_records: int = 120,
) -> list[dict[str, Any]]:
    """
    Produce prediction-vs-actual records from held-out test sequences.

    Returns empty list if no checkpoint is available.
    """
    ckpt_path = _backend_root() / "models" / "best_model.pt"
    if not ckpt_path.exists():
        return []

    code = country_code.upper()
    try:
        df = load_country_dataframe(code)
        if df is None or len(df) < 20:
            return []

        config = TrainingConfig().resolved_paths(_backend_root())
        if len(df) < config.window_size + config.forecast_horizon + 10:
            return []

        _, _, test_ds, preprocessor = prepare_datasets(df, config)

        checkpoint = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        ckpt_cfg = checkpoint.get("config", {})

        model = TSTransformer(
            n_features=ckpt_cfg.get("n_features", config.n_features),
            d_model=ckpt_cfg.get("d_model", 128),
            nhead=ckpt_cfg.get("nhead", 8),
            num_layers=ckpt_cfg.get("num_layers", 4),
            dim_feedforward=ckpt_cfg.get("dim_feedforward", 512),
            dropout=0.0,
            forecast_horizon=ckpt_cfg.get("forecast_horizon", config.forecast_horizon),
        )
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()

        loader = DataLoader(test_ds, batch_size=32, shuffle=False)
        records: list[dict[str, Any]] = []

        with torch.no_grad():
            for batch_x, batch_y in loader:
                outputs = model(batch_x)
                preds = outputs["inflation_rate"].cpu().numpy()
                targets = batch_y.numpy()

                if preprocessor.target_scaler is not None:
                    n, h = preds.shape
                    preds = preprocessor.inverse_transform_target(
                        preds.reshape(-1, 1)
                    ).reshape(n, h)
                    targets = preprocessor.inverse_transform_target(
                        targets.reshape(-1, 1)
                    ).reshape(n, h)

                for i in range(len(preds)):
                    pred_h1 = float(preds[i, 0])
                    actual_h1 = float(targets[i, 0])
                    err = abs(pred_h1 - actual_h1)
                    records.append({
                        "country_code": code,
                        "predicted_value": round(pred_h1, 2),
                        "actual_value": round(actual_h1, 2),
                        "rmse": round(err, 3),
                        "mae": round(err, 3),
                        "mape": round(err / max(abs(actual_h1), 0.1) * 100, 2),
                        "model_version": BACKTEST_MODEL_VERSION,
                    })

        return records[-max_records:]
    except Exception as exc:
        logger.warning("Backtest failed for %s: %s", code, exc)
        return []


def run_all_backtest_records(
    countries: tuple[str, ...] = SUPPORTED_BACKTEST_COUNTRIES,
) -> list[dict[str, Any]]:
    """Run backtest for each supported country and return combined records."""
    combined: list[dict[str, Any]] = []
    for code in countries:
        combined.extend(run_backtest_records(code))
    return combined


def compute_accuracy_from_records(records: list[dict[str, Any]]) -> dict[str, float]:
    """Compute aggregate accuracy metrics from backtest record dicts."""
    if not records:
        return {"mape": 100.0, "accuracy_pct": 0.0, "rmse": 0.0, "mae": 0.0, "r2_score": 0.0}

    errors = [abs(r["predicted_value"] - r["actual_value"]) for r in records]
    actuals = [r["actual_value"] for r in records]
    preds = [r["predicted_value"] for r in records]

    rmse = float(np.sqrt(np.mean(np.array(errors) ** 2)))
    mae = float(np.mean(errors))
    mape = float(
        np.mean([e / max(abs(a), 0.1) * 100 for e, a in zip(errors, actuals)])
    )
    ss_res = sum((a - p) ** 2 for a, p in zip(actuals, preds))
    ss_tot = sum((a - np.mean(actuals)) ** 2 for a in actuals) or 1.0
    r2 = round(1 - ss_res / ss_tot, 4) if ss_tot else 0.0

    return {
        "rmse": round(rmse, 3),
        "mae": round(mae, 3),
        "mape": round(mape, 2),
        "accuracy_pct": round(max(0.0, 100.0 - mape), 1),
        "r2_score": r2,
    }