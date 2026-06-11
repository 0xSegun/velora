"""
Inflation Predictor — Production Inference Engine.

Loads a trained TSTransformer checkpoint and fitted scalers, preprocesses
raw input data, runs model inference, and returns structured predictions
ready for the API layer.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np
import torch

from ai.inference.postprocess import PostProcessor
from ai.model.transformer import TSTransformer
from ai.pipeline.preprocess import DEFAULT_FEATURE_COLS, DataPreprocessor

logger = logging.getLogger(__name__)


class InflationPredictor:
    """Production-ready inflation prediction engine.

    Parameters
    ----------
    model_path : str
        Path to the saved ``.pt`` checkpoint.
    scaler_path : str
        Directory containing ``feature_scaler.json`` and ``target_scaler.json``.
    device : str | None
        Force a device; defaults to CUDA if available.
    """

    def __init__(
        self,
        model_path: str,
        scaler_path: str,
        device: str | None = None,
    ) -> None:
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device)

        # ── Load checkpoint ──────────────────────────────────────────
        checkpoint = torch.load(
            model_path, map_location=self.device, weights_only=False
        )
        config = checkpoint.get("config", {})

        self.window_size: int = config.get("window_size", 24)
        self.forecast_horizon: int = config.get("forecast_horizon", 6)
        self.n_features: int = config.get("n_features", 8)

        self.model = TSTransformer(
            n_features=self.n_features,
            d_model=config.get("d_model", 128),
            nhead=config.get("nhead", 8),
            num_layers=config.get("num_layers", 4),
            dim_feedforward=config.get("dim_feedforward", 512),
            dropout=0.0,  # no dropout at inference
            forecast_horizon=self.forecast_horizon,
        )
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()
        logger.info(
            "Loaded model from %s (epoch %d, val_loss=%.6f)",
            model_path,
            checkpoint.get("epoch", -1),
            checkpoint.get("val_loss", -1),
        )

        # ── Load scalers ─────────────────────────────────────────────
        self.preprocessor = DataPreprocessor(
            window_size=self.window_size,
            forecast_horizon=self.forecast_horizon,
        )
        self.preprocessor.load_scalers(scaler_path)

        # ── Post-processor ───────────────────────────────────────────
        self.postprocessor = PostProcessor()

    # ------------------------------------------------------------------
    # Single prediction
    # ------------------------------------------------------------------
    @torch.no_grad()
    def predict(
        self,
        input_data: dict[str, list[float]],
        forecast_horizon: int | None = None,
        country_code: str = "NG",
    ) -> dict[str, Any]:
        """Run inference on a single set of recent economic observations.

        Parameters
        ----------
        input_data : dict[str, list[float]]
            Mapping of feature name → list of historical values.  Each list
            must have at least ``window_size`` elements (the most recent
            ``window_size`` are used).
        forecast_horizon : int | None
            Override the model's default forecast horizon.
        country_code : str
            ISO country code (for contextual post-processing).

        Returns
        -------
        dict[str, Any]
            Structured prediction result (see :class:`PostProcessor`).
        """
        horizon = forecast_horizon or self.forecast_horizon

        # 1. Validate and align input
        features = self._prepare_input(input_data)  # (1, window, n_feat)

        # 2. Forward pass
        features_tensor = torch.from_numpy(features).float().to(self.device)
        outputs = self.model(features_tensor)

        # 3. Extract raw outputs
        raw = self._extract_raw(outputs, horizon)

        # 4. Inverse-scale inflation rate predictions
        raw["inflation_rate"] = self.preprocessor.inverse_transform_target(
            np.array(raw["inflation_rate"]).reshape(-1, 1)
        ).flatten().tolist()

        # 5. Post-process
        return self.postprocessor.process(
            raw_output=raw,
            country_code=country_code,
            forecast_horizon=horizon,
        )

    # ------------------------------------------------------------------
    # Batch prediction
    # ------------------------------------------------------------------
    @torch.no_grad()
    def predict_batch(
        self,
        countries: list[str],
        data: dict[str, dict[str, list[float]]],
        forecast_horizon: int | None = None,
    ) -> list[dict[str, Any]]:
        """Predict for multiple countries.

        Parameters
        ----------
        countries : list[str]
            List of country codes.
        data : dict[str, dict[str, list[float]]]
            ``{country_code: {feature_name: [values]}}``
        forecast_horizon : int | None
            Override default horizon.

        Returns
        -------
        list[dict[str, Any]]
            One prediction dict per country.
        """
        results: list[dict[str, Any]] = []
        for cc in countries:
            if cc not in data:
                logger.warning("No data for country %s — skipping", cc)
                continue
            try:
                result = self.predict(
                    input_data=data[cc],
                    forecast_horizon=forecast_horizon,
                    country_code=cc,
                )
                results.append(result)
            except Exception as exc:
                logger.error("Prediction failed for %s: %s", cc, exc)
                results.append(
                    {
                        "country_code": cc,
                        "error": str(exc),
                        "status": "failed",
                    }
                )
        return results

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _prepare_input(
        self, input_data: dict[str, list[float]]
    ) -> np.ndarray:
        """Validate, align, scale and window the input data.

        Returns
        -------
        np.ndarray
            Shape ``(1, window_size, n_features)``.
        """
        feature_cols = list(DEFAULT_FEATURE_COLS)

        # Ensure all features are present
        missing = [c for c in feature_cols if c not in input_data]
        if missing:
            raise ValueError(f"Missing input features: {missing}")

        # Build array
        min_len = min(len(input_data[c]) for c in feature_cols)
        if min_len < self.window_size:
            raise ValueError(
                f"Need at least {self.window_size} observations per feature, "
                f"got {min_len}"
            )

        # Take the most recent window_size observations
        raw = np.column_stack(
            [input_data[c][-self.window_size :] for c in feature_cols]
        ).astype(np.float32)  # (window_size, n_features)

        # Scale
        scaled = self.preprocessor.feature_scaler.transform(raw)

        return scaled[np.newaxis, :, :]  # (1, window_size, n_features)

    @staticmethod
    def _extract_raw(
        outputs: dict[str, torch.Tensor],
        horizon: int,
    ) -> dict[str, Any]:
        """Pull raw NumPy values out of the model output dict."""
        inflation = outputs["inflation_rate"][0, :horizon].cpu().numpy().tolist()
        deflation_prob = float(outputs["deflation_probability"][0, 0].cpu().item())
        trend_logits = outputs["trend_direction"][0].cpu().numpy()
        confidence = float(outputs["confidence_score"][0, 0].cpu().item())
        risk = float(outputs["risk_level"][0, 0].cpu().item())

        # Decode trend
        trend_idx = int(trend_logits.argmax())
        trend_map = {0: -1, 1: 0, 2: 1}  # down, stable, up
        trend_direction = trend_map[trend_idx]

        return {
            "inflation_rate": inflation,
            "deflation_probability": deflation_prob,
            "trend_direction": trend_direction,
            "trend_logits": trend_logits.tolist(),
            "confidence_score": confidence,
            "risk_level": risk,
        }
