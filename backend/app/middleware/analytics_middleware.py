"""
Middleware to track API request analytics events.
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.database import async_session_factory
from app.services import analytics_service
from app.services.analytics_tracker import track_event

logger = logging.getLogger(__name__)

SKIP_PREFIXES = (
    "/docs",
    "/redoc",
    "/openapi.json",
    "/health",
    "/api/analytics/ws",
    "/files/",
)


class AnalyticsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        should_track = (
            path.startswith("/api/")
            and not any(path.startswith(p) for p in SKIP_PREFIXES)
            and request.method in ("GET", "POST", "PUT", "DELETE", "PATCH")
        )

        response = await call_next(request)

        if should_track:
            try:
                async with async_session_factory() as db:
                    config = await analytics_service.get_analytics_config(db)
                    if config.get("tracking_enabled", True):
                        modules = config.get("modules", {})
                        if modules.get("system", True):
                            await track_event(
                                db,
                                event_type="api_request",
                                metadata={
                                    "path": path,
                                    "method": request.method,
                                    "status": response.status_code,
                                },
                                request=request,
                                broadcast=False,
                            )
                            await db.commit()
            except Exception as exc:
                logger.debug("Analytics middleware skipped: %s", exc)

        return response