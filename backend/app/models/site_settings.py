"""
Site settings, AI model registry, and notification models.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from app.models.base_types import pg_enum
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── SiteSettings ──────────────────────────────────────────────────────────────


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    key: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    value: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    category: Mapped[str] = mapped_column(
        String(100), nullable=False, default="general"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


# ── AIModel ───────────────────────────────────────────────────────────────────


class ModelStatus(str, enum.Enum):
    TRAINING = "training"
    READY = "ready"
    ARCHIVED = "archived"


class AIModel(Base):
    __tablename__ = "ai_models"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    precision_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    f1_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[ModelStatus] = mapped_column(
        pg_enum(ModelStatus), nullable=False, default=ModelStatus.TRAINING
    )
    model_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    hyperparams: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    trained_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AIModel {self.name} v{self.version} ({self.status.value})>"


# ── Notification ──────────────────────────────────────────────────────────────


class NotificationType(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ALERT = "alert"
    PREDICTION = "prediction"
    TRAINING = "training"
    DATASET = "dataset"
    MODEL = "model"
    SYSTEM = "system"
    SECURITY = "security"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[NotificationType] = mapped_column(
        pg_enum(NotificationType), nullable=False, default=NotificationType.INFO
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification {self.title} ({self.type.value})>"
