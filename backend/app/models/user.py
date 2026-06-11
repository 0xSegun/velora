"""
User ORM model with role-based access control.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from app.models.base_types import pg_enum
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
    ANALYST = "analyst"


class AuthProvider(str, enum.Enum):
    LOCAL = "local"
    GOOGLE = "google"
    LINKED = "linked"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    first_name: Mapped[str] = mapped_column(String(128), nullable=False, default="User")
    last_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, default="User")
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    institution: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str] = mapped_column(String(10), nullable=False, default="NG")
    tracked_countries: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Africa/Lagos"
    )
    auth_provider: Mapped[str] = mapped_column(
        String(20), nullable=False, default=AuthProvider.LOCAL.value
    )
    google_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    role: Mapped[UserRole] = mapped_column(
        pg_enum(UserRole), nullable=False, default=UserRole.USER
    )
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    predictions = relationship("Prediction", back_populates="user", lazy="selectin")
    notifications = relationship("Notification", back_populates="user", lazy="selectin")
    reports = relationship("Report", back_populates="user", lazy="selectin")
    sessions = relationship("UserSession", back_populates="user", lazy="selectin")

    @property
    def display_name(self) -> str:
        combined = f"{self.first_name} {self.last_name}".strip()
        return combined or self.full_name

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role.value})>"