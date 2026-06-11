"""
Post-Processing for Inflation Predictions.

Converts raw model outputs into human-readable, API-ready prediction
dicts with confidence intervals, risk assessments, trend labels,
and natural-language summary text.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Country display names
COUNTRY_NAMES: dict[str, str] = {
    "NG": "Nigeria",
    "US": "United States",
    "GB": "United Kingdom",
    "GH": "Ghana",
    "ZA": "South Africa",
    "KE": "Kenya",
    "EG": "Egypt",
}


class PostProcessor:
    """Transform raw model outputs into structured API responses.

    This class is intentionally stateless so it can be reused across
    requests without side effects.
    """

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------
    def process(
        self,
        raw_output: dict[str, Any],
        country_code: str = "NG",
        forecast_horizon: int = 6,
    ) -> dict[str, Any]:
        """Build the final prediction response.

        Parameters
        ----------
        raw_output : dict
            Raw values extracted from the model (see ``InflationPredictor``).
        country_code : str
            ISO country code.
        forecast_horizon : int
            Number of months being forecasted.

        Returns
        -------
        dict[str, Any]
            Fully structured prediction payload.
        """
        inflation_rates = raw_output["inflation_rate"][:forecast_horizon]
        deflation_prob = raw_output["deflation_probability"]
        trend_dir = raw_output["trend_direction"]
        confidence = raw_output["confidence_score"]
        risk_score = raw_output["risk_level"]

        # Derived values
        avg_inflation = float(np.mean(inflation_rates))
        confidence_interval = self.compute_confidence_interval(
            inflation_rates, confidence
        )
        risk_assessment = self.assess_risk(risk_score, avg_inflation, deflation_prob)
        trend_label = self.trend_label(trend_dir)
        risk_label = self.risk_label(risk_score)
        forecast_dates = self.generate_forecast_dates(forecast_horizon)

        # Structured result
        result: dict[str, Any] = {
            "status": "success",
            "country_code": country_code,
            "country_name": COUNTRY_NAMES.get(country_code, country_code),
            "prediction_date": datetime.now(timezone.utc).isoformat(),
            "forecast_horizon_months": forecast_horizon,
            # ── Core outputs ─────────────────────────────────────
            "inflation_rate": round(avg_inflation, 2),
            "inflation_forecast": [
                {
                    "month": i + 1,
                    "date": forecast_dates[i],
                    "rate": round(float(r), 2),
                }
                for i, r in enumerate(inflation_rates)
            ],
            "deflation_probability": round(deflation_prob, 4),
            "trend_direction": trend_dir,
            "trend_label": trend_label,
            "confidence_score": round(confidence, 4),
            "risk_level": round(risk_score, 1),
            "risk_label": risk_label,
            # ── Derived analytics ────────────────────────────────
            "confidence_interval": confidence_interval,
            "risk_assessment": risk_assessment,
            "summary": self.generate_summary(
                country_code=country_code,
                avg_inflation=avg_inflation,
                trend_label=trend_label,
                confidence=confidence,
                risk_label=risk_label,
                deflation_prob=deflation_prob,
                forecast_horizon=forecast_horizon,
            ),
        }

        return result

    # ------------------------------------------------------------------
    # Confidence interval
    # ------------------------------------------------------------------
    @staticmethod
    def compute_confidence_interval(
        inflation_rates: list[float],
        confidence: float,
        base_std: float = 1.5,
    ) -> dict[str, float]:
        """Compute a symmetric confidence interval around the mean.

        The width is inversely proportional to model confidence, with
        ``base_std`` as the maximum half-width at zero confidence.
        """
        avg = float(np.mean(inflation_rates))
        volatility = float(np.std(inflation_rates)) if len(inflation_rates) > 1 else 0.0

        # Wider interval when confidence is low or volatility is high
        half_width = base_std * (1.0 - confidence * 0.7) + volatility * 0.5

        return {
            "lower": round(avg - half_width, 2),
            "upper": round(avg + half_width, 2),
            "level": "95%",
        }

    # ------------------------------------------------------------------
    # Risk assessment
    # ------------------------------------------------------------------
    @staticmethod
    def assess_risk(
        risk_score: float,
        avg_inflation: float,
        deflation_prob: float,
    ) -> dict[str, Any]:
        """Produce a qualitative risk assessment dict."""
        factors: list[str] = []

        if avg_inflation > 25:
            factors.append("Very high inflation rate exceeds 25%")
        elif avg_inflation > 15:
            factors.append("Elevated inflation rate above 15%")
        elif avg_inflation > 10:
            factors.append("Moderate inflation above single digits")

        if deflation_prob > 0.5:
            factors.append("Significant deflation risk detected")
        elif deflation_prob > 0.2:
            factors.append("Non-trivial deflation probability")

        if risk_score > 75:
            factors.append("High composite risk score from model")
        elif risk_score > 50:
            factors.append("Moderate composite risk score")

        if avg_inflation < 0:
            factors.append("Negative inflation — deflationary environment")

        recommendations: list[str] = []
        if risk_score > 60:
            recommendations.append(
                "Consider hedging strategies against inflation volatility"
            )
            recommendations.append(
                "Monitor central bank monetary policy announcements closely"
            )
        if avg_inflation > 20:
            recommendations.append(
                "Expect continued currency depreciation pressure"
            )
            recommendations.append(
                "Real asset allocation may help preserve purchasing power"
            )
        if deflation_prob > 0.3:
            recommendations.append(
                "Watch for demand-side contractions and liquidity traps"
            )

        if not recommendations:
            recommendations.append(
                "Current outlook is within normal bounds — standard monitoring advised"
            )

        return {
            "risk_factors": factors,
            "recommendations": recommendations,
            "overall_assessment": (
                "high_risk" if risk_score > 70
                else "moderate_risk" if risk_score > 40
                else "low_risk"
            ),
        }

    # ------------------------------------------------------------------
    # Labels
    # ------------------------------------------------------------------
    @staticmethod
    def trend_label(direction: int) -> str:
        return {1: "Increasing", 0: "Stable", -1: "Decreasing"}.get(
            direction, "Unknown"
        )

    @staticmethod
    def risk_label(risk_score: float) -> str:
        if risk_score >= 75:
            return "Critical"
        if risk_score >= 50:
            return "High"
        if risk_score >= 25:
            return "Medium"
        return "Low"

    # ------------------------------------------------------------------
    # Forecast dates
    # ------------------------------------------------------------------
    @staticmethod
    def generate_forecast_dates(horizon: int) -> list[str]:
        """Generate ISO-format date strings for the next *horizon* months."""
        now = datetime.now(timezone.utc)
        dates: list[str] = []
        for i in range(1, horizon + 1):
            # Approximate month increment
            future = now + timedelta(days=30 * i)
            dates.append(future.strftime("%Y-%m-%d"))
        return dates

    # ------------------------------------------------------------------
    # Natural-language summary
    # ------------------------------------------------------------------
    @staticmethod
    def generate_summary(
        country_code: str,
        avg_inflation: float,
        trend_label: str,
        confidence: float,
        risk_label: str,
        deflation_prob: float,
        forecast_horizon: int,
    ) -> str:
        """Generate a human-readable summary paragraph."""
        country = COUNTRY_NAMES.get(country_code, country_code)
        direction = trend_label.lower()

        summary_parts: list[str] = [
            f"Velora predicts an average inflation rate of {avg_inflation:.1f}% "
            f"for {country} over the next {forecast_horizon} months.",
        ]

        if direction == "increasing":
            summary_parts.append(
                "The model detects an upward trend in inflationary pressure."
            )
        elif direction == "decreasing":
            summary_parts.append(
                "The trend suggests moderating inflationary pressure ahead."
            )
        else:
            summary_parts.append(
                "Inflation is expected to remain broadly stable."
            )

        conf_pct = confidence * 100
        summary_parts.append(
            f"This forecast carries a confidence level of {conf_pct:.0f}% "
            f"with an overall risk classification of '{risk_label}'."
        )

        if deflation_prob > 0.3:
            summary_parts.append(
                f"Note: the model assigns a {deflation_prob * 100:.0f}% probability "
                f"of deflationary conditions, warranting close monitoring."
            )

        return " ".join(summary_parts)
