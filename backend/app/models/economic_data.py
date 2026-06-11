"""
EconomicData ORM model — stores macroeconomic indicators by country and date.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Date, DateTime, Float, String
from app.models.base_types import pg_enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DataSource(str, enum.Enum):
    CBN = "CBN"
    NBS = "NBS"
    FRED = "FRED"
    MANUAL = "MANUAL"
    EXCHANGE_RATE_API = "EXCHANGE_RATE_API"


class EconomicData(Base):
    __tablename__ = "economic_data"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    country_code: Mapped[str] = mapped_column(
        String(10), nullable=False, index=True
    )
    country_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cpi: Mapped[float | None] = mapped_column(Float, nullable=True)
    gdp: Mapped[float | None] = mapped_column(Float, nullable=True)
    gdp_growth: Mapped[float | None] = mapped_column(Float, nullable=True)
    interest_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    exchange_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    oil_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    gov_spending: Mapped[float | None] = mapped_column(Float, nullable=True)
    employment_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    unemployment_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    inflation_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    money_supply: Mapped[float | None] = mapped_column(Float, nullable=True)
    trade_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    core_inflation: Mapped[float | None] = mapped_column(Float, nullable=True)
    producer_price_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    consumer_confidence_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    purchasing_managers_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    public_debt_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    commodity_price_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    housing_price_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    retail_sales: Mapped[float | None] = mapped_column(Float, nullable=True)
    foreign_reserves: Mapped[float | None] = mapped_column(Float, nullable=True)
    fiscal_deficit: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_date: Mapped[datetime] = mapped_column(
        Date, nullable=False, index=True
    )
    source: Mapped[DataSource] = mapped_column(
        pg_enum(DataSource), nullable=False, default=DataSource.MANUAL
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<EconomicData {self.country_code} {self.data_date}>"
