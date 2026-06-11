"""
Economic data request/response schemas.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class EconomicDataResponse(BaseModel):
    id: uuid.UUID
    country_code: str
    country_name: str
    cpi: float | None = None
    gdp: float | None = None
    gdp_growth: float | None = None
    interest_rate: float | None = None
    exchange_rate: float | None = None
    oil_price: float | None = None
    gov_spending: float | None = None
    employment_rate: float | None = None
    unemployment_rate: float | None = None
    inflation_rate: float | None = None
    money_supply: float | None = None
    trade_balance: float | None = None
    data_date: date
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EconomicDataCreate(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=10)
    country_name: str = Field(..., max_length=255)
    cpi: float | None = None
    gdp: float | None = None
    gdp_growth: float | None = None
    interest_rate: float | None = None
    exchange_rate: float | None = None
    oil_price: float | None = None
    gov_spending: float | None = None
    employment_rate: float | None = None
    unemployment_rate: float | None = None
    inflation_rate: float | None = None
    money_supply: float | None = None
    trade_balance: float | None = None
    data_date: date
    source: str = "MANUAL"


class CountryDataResponse(BaseModel):
    country_code: str
    country_name: str
    latest: EconomicDataResponse | None = None
    historical: list[EconomicDataResponse] = []
    total_records: int = 0


class EconomicDataUploadResponse(BaseModel):
    created: int
    errors: list[str] = []
