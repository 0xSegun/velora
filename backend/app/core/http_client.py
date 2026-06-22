"""Shared async HTTP client with timeout and retry defaults for external APIs."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = httpx.Timeout(connect=5.0, read=20.0, write=10.0, pool=5.0)
MAX_RETRIES = 3
RETRY_BACKOFF = 0.5


async def request_with_retry(
    method: str,
    url: str,
    *,
    timeout: httpx.Timeout | float | None = DEFAULT_TIMEOUT,
    retries: int = MAX_RETRIES,
    **kwargs: Any,
) -> httpx.Response:
    """Perform an HTTP request with exponential backoff on transient failures."""
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(method, url, **kwargs)
                if response.status_code in {429, 500, 502, 503, 504} and attempt < retries - 1:
                    await asyncio.sleep(RETRY_BACKOFF * (2**attempt))
                    continue
                return response
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            last_exc = exc
            if attempt < retries - 1:
                await asyncio.sleep(RETRY_BACKOFF * (2**attempt))
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("request_with_retry exhausted without response")