"""Seed or sync economic indicators for all countries."""

import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database.session import async_session_factory
from app.services.seed_service import (
    seed_default_countries,
    seed_economic_data,
    sync_countries_to_economic_data,
)


async def main() -> None:
    async with async_session_factory() as db:
        countries = await seed_default_countries(db)
        economic = await seed_economic_data(db)
        synced = await sync_countries_to_economic_data(db)
        await db.commit()
        print(
            f"Done. countries_added={countries}, "
            f"economic_seeded={economic}, synced={synced}"
        )


if __name__ == "__main__":
    asyncio.run(main())