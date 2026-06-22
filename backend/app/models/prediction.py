"""
Prediction ORM model — stores inflation forecast results.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    country_code: Mapped[str] = mapped_column(
        String(10), nullable=False, index=True
    )
    inflation_rate: Mapped[float] = mapped_column(Float, nullable=False)
    deflation_probability: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    trend_direction: Mapped[str] = mapped_column(
        String(20), nullable=False  # "up", "down", "stable"
    )
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(
        String(20), nullable=False  # "low", "medium", "high", "critical"
    )
    input_params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    output_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    forecast_horizon: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    prediction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    target_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    explainability: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    multi_horizon: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    confidence_bands: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    reliability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    reliability_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    economic_regime: Mapped[str | None] = mapped_column(String(30), nullable=True)
    data_lineage: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    using_cached_data: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    user = relationship("User", back_populates="predictions")
    details = relationship(
        "PredictionDetail",
        back_populates="prediction",
        uselist=False,
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Prediction {self.country_code} rate={self.inflation_rate}%>"
