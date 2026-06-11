"""
Portable PostgreSQL auto-start for local development (Windows).
"""

import logging
import subprocess
import time
from pathlib import Path

logger = logging.getLogger(__name__)
BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent
_ARCHIVED = REPO_ROOT.parent / "backup_archive" / "local_postgres_bundle"
PG_ROOT = BACKEND_ROOT / "postgres" if (BACKEND_ROOT / "postgres" / "bin" / "pg_ctl.exe").exists() else _ARCHIVED
DATA_DIR = PG_ROOT / "data"
PG_CTL = PG_ROOT / "bin" / "pg_ctl.exe"
LOG_FILE = PG_ROOT / "postgres.log"


def ensure_postgres_running(port: int = 5432, max_wait_seconds: int = 15) -> bool:
    """Start bundled PostgreSQL if present and wait until port accepts connections."""
    if not PG_CTL.exists() or not DATA_DIR.exists():
        logger.debug("Portable PostgreSQL not found at %s", PG_ROOT)
        return False

    try:
        status = subprocess.run(
            [str(PG_CTL), "status", "-D", str(DATA_DIR)],
            capture_output=True,
            text=True,
            check=False,
        )
        if status.returncode != 0:
            logger.info("Starting portable PostgreSQL on port %s...", port)
            subprocess.run(
                [
                    str(PG_CTL),
                    "start",
                    "-D",
                    str(DATA_DIR),
                    "-l",
                    str(LOG_FILE),
                    "-o",
                    f"-p {port}",
                ],
                check=False,
            )
    except Exception as exc:
        logger.warning("Could not start PostgreSQL: %s", exc)
        return False

    # Wait for port
    import socket

    deadline = time.time() + max_wait_seconds
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                logger.info("PostgreSQL is accepting connections on port %s", port)
                return True
        except OSError:
            time.sleep(0.5)

    logger.warning("PostgreSQL did not become ready within %ss", max_wait_seconds)
    return False