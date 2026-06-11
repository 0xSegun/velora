"""
SlowAPI rate-limiting configuration for FastAPI.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request


def _key_func(request: Request) -> str:
    """Derive rate-limit key: authenticated user id or remote IP."""
    if hasattr(request.state, "user") and request.state.user:
        return str(request.state.user.id)
    return get_remote_address(request)


limiter = Limiter(key_func=_key_func, default_limits=["200/minute"])


def setup_rate_limiting(app):
    """Attach the SlowAPI limiter and error handler to a FastAPI app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
