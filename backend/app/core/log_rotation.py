"""Application log rotation helpers."""

from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path


def setup_file_logging(
    log_dir: str | Path = "logs",
    *,
    max_bytes: int = 5 * 1024 * 1024,
    backup_count: int = 5,
    level: int = logging.INFO,
) -> None:
    """Attach a rotating file handler for production diagnostics."""
    path = Path(log_dir)
    path.mkdir(parents=True, exist_ok=True)
    log_file = path / "app.log"

    root = logging.getLogger()
    if any(isinstance(h, logging.handlers.RotatingFileHandler) for h in root.handlers):
        return

    handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
    )
    handler.setLevel(level)
    root.addHandler(handler)


def prune_old_archives(archive_dir: str | Path, *, keep_days: int = 14) -> int:
    """Remove archived log files older than keep_days. Returns files removed."""
    from datetime import datetime, timedelta, timezone

    path = Path(archive_dir)
    if not path.is_dir():
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)
    removed = 0
    for item in path.iterdir():
        if not item.is_file():
            continue
        mtime = datetime.fromtimestamp(item.stat().st_mtime, tz=timezone.utc)
        if mtime < cutoff:
            item.unlink(missing_ok=True)
            removed += 1
    return removed