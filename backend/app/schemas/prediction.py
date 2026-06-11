"""
Prediction request/response schemas.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PredictionInputData(BaseModel):
    cpi: float | None = None
    gdp: float | None = None
    gdp_growth: float | None = None
    interest_rate: float | None = None
    exchange_rate: float | None = None
    oil_price: float | None = None
    gov_spending: float | None = None
    employment_rate: float | None = None
    unemployment_rate: float | None = None
    money_supply: float | None = None
    trade_balance: float | None = None


class PredictionRequest(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=10)
    input_data: PredictionInputData
    forecast_horizon: int = Field(default=6, ge=1, le=24)  # months


class ForecastPoint(BaseModel):
    month: int
    date: str
    predicted_rate: float
    lower_bound: float
    upper_bound: float


class PredictionResponse(BaseModel):
    id: uuid.UUID
    country_code: str
    inflation_rate: float
    deflation_probability: float
    trend_direction: str
    confidence_score: float
    risk_level: str
    forecast_data: list[ForecastPoint] = []
    input_params: dict = {}
    created_at: datetime
    prediction_period: str | None = None
    forecast_horizon: int | None = None
    key_influencing_factors: list[str] = []
    ai_summary: str | None = None
    recommended_actions: list[str] = []
    historical_comparison: dict = {}
    confidence_interval: dict = {}
    data_sources_used: list[str] = []
    model_version: str | None = None
    explainability: dict = {}
    multi_horizon: dict = {}
    confidence_bands: dict = {}

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class PredictionHistory(BaseModel):
    predictions: list[PredictionResponse]
    total: int
    page: int
    per_page: int


class PredictionCompareRequest(BaseModel):
    country_codes: list[str] = Field(..., min_length=2, max_length=10)
    forecast_horizon: int = Field(default=6, ge=1, le=24)


class PredictionCompareResponse(BaseModel):
    comparisons: dict[str, PredictionResponse]
