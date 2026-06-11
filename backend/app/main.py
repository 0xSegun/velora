"""
Velora — Inflation Prediction Platform API.

Main FastAPI application with CORS, rate limiting, routers, and lifecycle events.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

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
    countries,
    dashboard,
    datasets,
    economic_data,
    exchange_rates,
    resend,
    intelligence,
    notifications,
    predictions,
    public,
    reports,
    search,
    system,
    training,
    users,
)
from app.services.exchange_rate_scheduler import (
    start_exchange_rate_scheduler,
    stop_exchange_rate_scheduler,
)

settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
if not settings.DEBUG:
    setup_file_logging("logs", level=logging.INFO)
    prune_old_archives("logs/archive", keep_days=14)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting %s (%s)", settings.APP_NAME, settings.APP_ENV)
    async with async_session_factory() as db:
        await bootstrap_database(db)
    logger.info("Database bootstrap complete")
    start_exchange_rate_scheduler()
    yield
    logger.info("Shutting down %s", settings.APP_NAME)
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
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

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
app.include_router(admin.router)
app.include_router(public.router)
app.include_router(analytics.router)
app.include_router(api_configs.router)
app.include_router(api_configs.alias_router)
app.include_router(intelligence.router)
app.include_router(intelligence.admin_router)
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
    }