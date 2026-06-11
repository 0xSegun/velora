"""Shared SQLAlchemy type helpers."""

import enum
from typing import TypeVar

from sqlalchemy import Enum

E = TypeVar("E", bound=enum.Enum)


def pg_enum(enum_class: type[E], **kwargs) -> Enum:
    """PostgreSQL enum column that persists enum values (not names)."""
    return Enum(
        enum_class,
        values_callable=lambda choices: [item.value for item in choices],
        **kwargs,
    )