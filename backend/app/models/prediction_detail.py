"""
Prediction detail ORM model — normalized forecast metadata.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PredictionDetail(Base):
    __tablename__ = "prediction_details"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    prediction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("predictions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    factors: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    indicators: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    historical_comparison: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    confidence_interval: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_actions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    data_sources: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    model_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    prediction = relationship("Prediction", back_populates="details", lazy="selectin")