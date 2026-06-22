"""
Velora — Inflation Prediction Platform API.

Main FastAPI application with CORS, rate limiting, routers, and lifecycle events.
"""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

# Configure stdout logging before heavy imports (Render captures stdout).
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    stream=sys.stdout,
    force=True,
)
_boot_logger = logging.getLogger("app.boot")
_boot_logger.info("Initializing Velora API...")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware

from app.config import get_settings
from app.core.log_rotation import prune_old_archives, setup_file_logging
from app.core.startup import bootstrap_database
from app.database import async_session_factory, close_db
from app.middleware.analytics_middleware import AnalyticsMiddleware
from app.middleware.rate_limit import setup_rate_limiting
from app.routers import (
    admin,
    branding,
    analytics,
    api_configs,
    auth,
    integrations,
    security,
    countries,
    dashboard,
    datasets,
    economic_data,
    exchange_rates,
    fred,
    news_api,
    imf_api,
    world_bank_api,
    trading_economics_api,
    wikipedia_api,
    resend,
    intelligence,
    notifications,
    predictions,
    public,
    reports,
    search,
    system,
    training,
    training_behaviour,
    users,
)
from app.services.exchange_rate_scheduler import (
    start_exchange_rate_scheduler,
    stop_exchange_rate_scheduler,
)
from app.services.fred_scheduler import start_fred_scheduler, stop_fred_scheduler
from app.services.news_scheduler import start_news_scheduler, stop_news_scheduler
from app.services.imf_scheduler import start_imf_scheduler, stop_imf_scheduler
from app.services.world_bank_scheduler import (
    start_world_bank_scheduler,
    stop_world_bank_scheduler,
)
from app.services.trading_economics_scheduler import (
    start_trading_economics_scheduler,
    stop_trading_economics_scheduler,
)
from app.services.wikipedia_scheduler import start_wikipedia_scheduler, stop_wikipedia_scheduler

settings = get_settings()

if settings.DEBUG:
    logging.getLogger().setLevel(logging.DEBUG)

_boot_logger.info(
    "Settings loaded — env=%s database_url_set=%s db_host=%s",
    settings.APP_ENV,
    bool(settings.DATABASE_URL.strip()),
    settings.database_host_label,
)

if not settings.DEBUG:
    setup_file_logging("logs", level=logging.INFO)
    prune_old_archives("logs/archive", keep_days=14)
logger = logging.getLogger(__name__)

_bootstrap_task: asyncio.Task | None = None


async def _bootstrap_and_start_schedulers() -> None:
    """Run migrations, seed data, and start background schedulers."""
    async with async_session_factory() as db:
        await bootstrap_database(db)
    logger.info("Database bootstrap complete")
    start_exchange_rate_scheduler()
    start_fred_scheduler()
    start_news_scheduler()
    start_imf_scheduler()
    start_world_bank_scheduler()
    start_trading_economics_scheduler()
    start_wikipedia_scheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    global _bootstrap_task
    logger.info("Starting %s (%s)", settings.APP_NAME, settings.APP_ENV)
    if settings.is_production:
        # Respond to Render health checks immediately; bootstrap runs in background.
        _bootstrap_task = asyncio.create_task(_bootstrap_and_start_schedulers())
    else:
        await _bootstrap_and_start_schedulers()
    yield
    logger.info("Shutting down %s", settings.APP_NAME)
    await stop_wikipedia_scheduler()
    await stop_trading_economics_scheduler()
    await stop_world_bank_scheduler()
    await stop_imf_scheduler()
    await stop_news_scheduler()
    await stop_fred_scheduler()
    await stop_exchange_rate_scheduler()
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-powered inflation prediction and economic analysis platform. "
        "Provides real-time forecasting, country comparisons, and economic "
        "data aggregation from FRED, CBN, and NBS sources."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_rate_limiting(app)
app.add_middleware(AnalyticsMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred. Please try again later.",
            "type": type(exc).__name__,
        },
    )


app.include_router(system.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(predictions.router)
app.include_router(economic_data.router)
app.include_router(countries.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(search.router)
app.include_router(datasets.router)
app.include_router(training.router)
app.include_router(training_behaviour.router)
app.include_router(admin.router)
app.include_router(public.router)
app.include_router(analytics.router)
app.include_router(api_configs.router)
app.include_router(api_configs.alias_router)
app.include_router(integrations.router)
app.include_router(security.router)
app.include_router(intelligence.router)
app.include_router(intelligence.admin_router)
app.include_router(fred.admin_router)
app.include_router(news_api.admin_router)
app.include_router(imf_api.admin_router)
app.include_router(world_bank_api.admin_router)
app.include_router(trading_economics_api.admin_router)
app.include_router(wikipedia_api.admin_router)
app.include_router(exchange_rates.admin_router)
app.include_router(exchange_rates.rates_admin_router)
app.include_router(exchange_rates.public_router)
app.include_router(resend.admin_router)
app.include_router(resend.stats_router)
app.include_router(branding.router)

try:
    from pathlib import Path

    backend_root = Path(__file__).resolve().parents[1]
    pdf_path = backend_root / settings.PDF_DIR
    pdf_path.mkdir(parents=True, exist_ok=True)
    app.mount("/files/pdfs", StaticFiles(directory=str(pdf_path)), name="report-pdfs")

    branding_path = backend_root / settings.UPLOAD_DIR / "branding"
    branding_path.mkdir(parents=True, exist_ok=True)
    app.mount("/files/branding", StaticFiles(directory=str(branding_path)), name="branding-assets")
except Exception as mount_exc:
    logger.warning("Static file mount skipped: %s", mount_exc)


@app.get("/", tags=["Health"], include_in_schema=False)
async def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
        "health": "/health",
        "training_behaviour": "/training-behaviour",
    }