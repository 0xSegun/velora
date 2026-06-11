"""
Resend email API management — config, proxy, statistics.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections import Counter
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.resend_email import ResendApiLog, ResendAuditLog, ResendEmailConfig
from app.models.user import User
from app.schemas.resend import (
    ResendConfigResponse,
    ResendConfigUpdate,
    ResendHealthResponse,
    ResendStatisticsResponse,
    ResendTestResponse,
)
from app.services.exchange_rate_service import decrypt_api_key, encrypt_api_key

logger = logging.getLogger(__name__)
settings = get_settings()

MASKED_KEY = "••••••••"
RESEND_BASE_URL = "https://api.resend.com"
GENERIC_API_ERROR = "Failed to connect to Resend API"

_runtime_cache: dict[str, str | bool | None] = {
    "api_key": None,
    "from_email": None,
    "reply_to": None,
    "is_active": False,
    "open_tracking": True,
    "click_tracking": True,
}


def _sync_runtime_cache(config: ResendEmailConfig) -> None:
    _runtime_cache["api_key"] = decrypt_api_key(config.api_key)
    _runtime_cache["from_email"] = config.from_email or settings.RESEND_FROM_EMAIL or None
    _runtime_cache["reply_to"] = config.reply_to
    _runtime_cache["is_active"] = config.is_active
    _runtime_cache["open_tracking"] = config.open_tracking
    _runtime_cache["click_tracking"] = config.click_tracking


def get_runtime_api_key() -> str | None:
    if _runtime_cache.get("is_active") and _runtime_cache.get("api_key"):
        return str(_runtime_cache["api_key"])
    return settings.RESEND_API_KEY or None


def get_runtime_from_email() -> str | None:
    if _runtime_cache.get("is_active") and _runtime_cache.get("from_email"):
        return str(_runtime_cache["from_email"])
    return settings.RESEND_FROM_EMAIL or settings.EMAIL_FROM or None


def get_runtime_reply_to() -> str | None:
    if _runtime_cache.get("is_active") and _runtime_cache.get("reply_to"):
        return str(_runtime_cache["reply_to"])
    return None


def get_runtime_tracking() -> tuple[bool, bool]:
    open_t = bool(_runtime_cache.get("open_tracking", True))
    click_t = bool(_runtime_cache.get("click_tracking", True))
    return open_t, click_t


def _health_status(config: ResendEmailConfig) -> str:
    if not config.is_active:
        return "inactive"
    if config.error_count > 0 and config.success_count == 0:
        return "red"
    if config.error_count > config.success_count:
        return "yellow"
    if config.is_active and config.api_key:
        return "green"
    return "yellow"


async def ensure_default_config(db: AsyncSession) -> ResendEmailConfig:
    result = await db.execute(select(ResendEmailConfig).limit(1))
    config = result.scalar_one_or_none()
    if config:
        _sync_runtime_cache(config)
        return config

    config = ResendEmailConfig(
        provider_name="Resend",
        base_url=RESEND_BASE_URL,
        from_email=settings.RESEND_FROM_EMAIL or None,
        is_active=False,
    )
    if settings.RESEND_API_KEY:
        config.api_key = encrypt_api_key(settings.RESEND_API_KEY)
    db.add(config)
    await db.flush()
    _sync_runtime_cache(config)
    logger.info("Seeded default resend_email_config")
    return config


async def get_config(db: AsyncSession) -> ResendEmailConfig:
    return await ensure_default_config(db)


def _to_config_response(config: ResendEmailConfig) -> ResendConfigResponse:
    return ResendConfigResponse(
        id=config.id,
        provider_name=config.provider_name,
        api_key_masked=MASKED_KEY if config.api_key else "",
        api_key_set=bool(config.api_key),
        base_url=config.base_url,
        from_email=config.from_email,
        reply_to=config.reply_to,
        open_tracking=config.open_tracking,
        click_tracking=config.click_tracking,
        is_active=config.is_active,
        last_sync=config.last_sync,
        error_count=config.error_count,
        success_count=config.success_count,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


async def _log_audit(
    db: AsyncSession,
    *,
    action: str,
    changed_fields: dict,
    admin_id: uuid.UUID | None,
) -> None:
    db.add(
        ResendAuditLog(
            action=action,
            changed_fields=changed_fields,
            admin_user_id=admin_id,
        )
    )


async def _log_api_call(
    db: AsyncSession,
    *,
    endpoint: str,
    success: bool,
    response_time_ms: float | None,
    status_code: int | None,
    error_message: str | None = None,
) -> None:
    db.add(
        ResendApiLog(
            endpoint=endpoint,
            request_timestamp=datetime.now(timezone.utc),
            response_time_ms=response_time_ms,
            success=success,
            error_message=error_message,
            status_code=status_code,
        )
    )


def _resolve_api_key(config: ResendEmailConfig, override: str | None = None) -> str:
    key = override or decrypt_api_key(config.api_key)
    if not key:
        raise HTTPException(status_code=400, detail="API key is not configured")
    return key


def _extract_data_list(payload: dict | list | None, key: str = "data") -> list:
    if not isinstance(payload, dict):
        return []
    raw = payload.get(key)
    return raw if isinstance(raw, list) else []


def _parse_resend_error(response_text: str, status_code: int) -> str:
    if not response_text:
        return GENERIC_API_ERROR
    try:
        payload = json.loads(response_text)
        if isinstance(payload, dict):
            message = payload.get("message") or payload.get("error")
            if isinstance(message, str) and message.strip():
                return message.strip()
    except Exception:
        pass
    if status_code == 401:
        return "Invalid Resend API key."
    if status_code == 403:
        return "Resend API access denied for this key."
    return response_text[:200] or GENERIC_API_ERROR


async def _resend_request(
    db: AsyncSession,
    config: ResendEmailConfig,
    *,
    method: str,
    path: str,
    api_key: str,
    json_body: dict | None = None,
    params: dict | None = None,
    soft_fail: bool = False,
) -> tuple[dict | list | None, float | None, int | None]:
    base = (config.base_url or RESEND_BASE_URL).rstrip("/")
    url = f"{base}{path}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": f"{settings.APP_NAME}/1.0",
    }
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                json=json_body,
                params=params,
            )
        response_time_ms = round((time.perf_counter() - start) * 1000, 2)
        status_code = response.status_code

        if status_code >= 400:
            err_text = response.text[:500]
            friendly_error = _parse_resend_error(err_text, status_code)
            await _log_api_call(
                db,
                endpoint=path,
                success=False,
                response_time_ms=response_time_ms,
                status_code=status_code,
                error_message=friendly_error,
            )
            config.error_count += 1
            if soft_fail:
                return None, response_time_ms, status_code
            raise HTTPException(
                status_code=502,
                detail=friendly_error,
            )

        try:
            payload = response.json() if response.content else {}
        except Exception:
            payload = {}

        await _log_api_call(
            db,
            endpoint=path,
            success=True,
            response_time_ms=response_time_ms,
            status_code=status_code,
        )
        config.success_count += 1
        return payload, response_time_ms, status_code
    except HTTPException:
        raise
    except Exception as exc:
        response_time_ms = round((time.perf_counter() - start) * 1000, 2)
        await _log_api_call(
            db,
            endpoint=path,
            success=False,
            response_time_ms=response_time_ms,
            status_code=None,
            error_message=str(exc),
        )
        config.error_count += 1
        logger.exception("Resend API request failed: %s", path)
        if soft_fail:
            return None, response_time_ms, None
        raise HTTPException(status_code=502, detail=GENERIC_API_ERROR) from exc


async def _fetch_list(
    db: AsyncSession,
    config: ResendEmailConfig,
    api_key: str,
    path: str,
    *,
    max_items: int = 100,
    soft_fail: bool = False,
) -> list[dict]:
    items: list[dict] = []
    after: str | None = None

    while len(items) < max_items:
        params: dict[str, str] = {}
        if after:
            params["after"] = after
        payload, _, status_code = await _resend_request(
            db,
            config,
            method="GET",
            path=path,
            api_key=api_key,
            params=params or None,
            soft_fail=soft_fail,
        )
        if payload is None or (status_code is not None and status_code >= 400):
            break
        if not isinstance(payload, dict):
            break
        batch = _extract_data_list(payload)
        items.extend(batch)
        if not payload.get("has_more") or not batch:
            break
        after = batch[-1].get("id")
        if not after:
            break

    return items[:max_items]


async def test_connection(
    db: AsyncSession,
    *,
    api_key_override: str | None = None,
    admin_id: uuid.UUID | None = None,
) -> ResendTestResponse:
    try:
        config = await get_config(db)
        try:
            test_key = _resolve_api_key(config, api_key_override)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else "API key is not configured"
            return ResendTestResponse(
                success=False,
                message=detail,
                diagnostics={"error_type": "missing_api_key"},
            )

        payload, response_time_ms, status_code = await _resend_request(
            db,
            config,
            method="GET",
            path="/domains",
            api_key=test_key,
        )
        domains = _extract_data_list(payload if isinstance(payload, dict) else None)
        verified = sum(
            1 for d in domains if isinstance(d, dict) and d.get("status") == "verified"
        )
        result = ResendTestResponse(
            success=True,
            message=f"Connected — {len(domains)} domain(s), {verified} verified",
            response_time_ms=response_time_ms,
            status_code=status_code,
            diagnostics={
                "domains_total": len(domains),
                "domains_verified": verified,
            },
        )
        if admin_id:
            await _log_audit(
                db,
                action="test_connection",
                changed_fields={"success": True, "domains": len(domains)},
                admin_id=admin_id,
            )
        config.last_sync = datetime.now(timezone.utc)
        _sync_runtime_cache(config)
        return result
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else GENERIC_API_ERROR
        if admin_id:
            await _log_audit(
                db,
                action="test_connection",
                changed_fields={"success": False, "error": detail},
                admin_id=admin_id,
            )
        return ResendTestResponse(
            success=False,
            message=detail,
            diagnostics={"error_type": "api_error"},
        )
    except Exception:
        logger.exception("Resend test connection failed")
        return ResendTestResponse(
            success=False,
            message="Connection test failed. Please try again.",
            diagnostics={"error_type": "unexpected_error"},
        )


async def send_test_email(
    db: AsyncSession,
    *,
    to: str,
    api_key_override: str | None = None,
    admin_id: uuid.UUID | None = None,
) -> ResendTestResponse:
    config = await get_config(db)
    test_key = _resolve_api_key(config, api_key_override)
    from_addr = config.from_email or settings.RESEND_FROM_EMAIL or settings.EMAIL_FROM
    if not from_addr:
        return ResendTestResponse(
            success=False,
            message="Configure a From email address before sending test emails",
            diagnostics={"error_type": "missing_from_email"},
        )

    body = {
        "from": from_addr,
        "to": [to],
        "subject": f"{settings.APP_NAME} — Resend Test Email",
        "html": (
            f"<p>This is a test email from <strong>{settings.APP_NAME}</strong> "
            f"sent via the Resend admin panel.</p>"
            f"<p>If you received this, your Resend integration is working.</p>"
        ),
    }
    if config.reply_to:
        body["reply_to"] = config.reply_to

    start = time.perf_counter()
    try:
        payload, response_time_ms, status_code = await _resend_request(
            db,
            config,
            method="POST",
            path="/emails",
            api_key=test_key,
            json_body=body,
        )
        email_id = payload.get("id") if isinstance(payload, dict) else None
        if admin_id:
            await _log_audit(
                db,
                action="send_test_email",
                changed_fields={"to": to, "email_id": email_id},
                admin_id=admin_id,
            )
        config.last_sync = datetime.now(timezone.utc)
        _sync_runtime_cache(config)
        return ResendTestResponse(
            success=True,
            message=f"Test email sent to {to}",
            response_time_ms=round((time.perf_counter() - start) * 1000, 2),
            status_code=status_code,
            diagnostics={"email_id": email_id},
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else GENERIC_API_ERROR
        return ResendTestResponse(success=False, message=detail)


def _audit_value(value: object) -> object:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


async def update_config(
    db: AsyncSession,
    *,
    admin: User,
    payload: ResendConfigUpdate,
) -> ResendConfigResponse:
    try:
        config = await get_config(db)
        data = payload.model_dump(exclude_unset=True)
        changed: dict = {}

        if "api_key" in data:
            key_val = data.pop("api_key")
            if key_val:
                config.api_key = encrypt_api_key(key_val)
                changed["api_key"] = "updated"

        for key, value in data.items():
            current = getattr(config, key, None)
            if value is not None and current != value:
                changed[key] = {"from": _audit_value(current), "to": _audit_value(value)}
                setattr(config, key, value)

        if changed:
            config.updated_at = datetime.now(timezone.utc)
            await _log_audit(db, action="config_update", changed_fields=changed, admin_id=admin.id)

        await db.flush()
        _sync_runtime_cache(config)
        return _to_config_response(config)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to update Resend config")
        raise HTTPException(
            status_code=500,
            detail="Failed to save Resend configuration. Please try again.",
        ) from exc


async def enable_api(db: AsyncSession, *, admin: User) -> ResendConfigResponse:
    config = await get_config(db)
    if not config.api_key:
        raise HTTPException(status_code=400, detail="Configure API key before enabling")
    if not config.from_email and not settings.RESEND_FROM_EMAIL:
        raise HTTPException(status_code=400, detail="Configure From email before enabling")
    config.is_active = True
    config.updated_at = datetime.now(timezone.utc)
    await _log_audit(db, action="enable", changed_fields={"is_active": True}, admin_id=admin.id)
    await db.flush()
    _sync_runtime_cache(config)
    return _to_config_response(config)


async def disable_api(db: AsyncSession, *, admin: User) -> ResendConfigResponse:
    config = await get_config(db)
    config.is_active = False
    config.updated_at = datetime.now(timezone.utc)
    await _log_audit(db, action="disable", changed_fields={"is_active": False}, admin_id=admin.id)
    await db.flush()
    _sync_runtime_cache(config)
    return _to_config_response(config)


async def get_health(db: AsyncSession) -> ResendHealthResponse:
    config = await get_config(db)
    total = config.success_count + config.error_count
    success_rate = round(config.success_count / total * 100, 1) if total else None

    domains_verified: int | None = None
    domains_total: int | None = None
    response_time_ms: float | None = None

    if config.api_key:
        try:
            api_key = _resolve_api_key(config)
            payload, response_time_ms, _ = await _resend_request(
                db, config, method="GET", path="/domains", api_key=api_key
            )
            domains = _extract_data_list(payload if isinstance(payload, dict) else None)
            domains_total = len(domains)
            domains_verified = sum(
                1 for d in domains if isinstance(d, dict) and d.get("status") == "verified"
            )
            config.last_sync = datetime.now(timezone.utc)
        except HTTPException:
            pass

    return ResendHealthResponse(
        provider=config.provider_name,
        status=_health_status(config),
        is_active=config.is_active,
        response_time_ms=response_time_ms,
        last_sync=config.last_sync,
        error_count=config.error_count,
        success_count=config.success_count,
        success_rate=success_rate,
        from_email=config.from_email,
        domains_verified=domains_verified,
        domains_total=domains_total,
    )


async def get_audit_logs(db: AsyncSession, *, limit: int = 100) -> list[dict]:
    from app.models.user import User as UserModel

    result = await db.execute(
        select(ResendAuditLog, UserModel.email)
        .outerjoin(UserModel, ResendAuditLog.admin_user_id == UserModel.id)
        .order_by(desc(ResendAuditLog.created_at))
        .limit(limit)
    )
    rows = []
    for log, admin_email in result.all():
        rows.append(
            {
                "id": log.id,
                "action": log.action,
                "changed_fields": log.changed_fields,
                "admin_user_id": log.admin_user_id,
                "admin_email": admin_email,
                "created_at": log.created_at,
            }
        )
    return rows


async def get_logs(
    db: AsyncSession,
    *,
    status_filter: str | None = None,
    limit: int = 100,
) -> list[ResendApiLog]:
    q = select(ResendApiLog).order_by(desc(ResendApiLog.request_timestamp)).limit(limit)
    if status_filter == "success":
        q = q.where(ResendApiLog.success.is_(True))
    elif status_filter == "failed":
        q = q.where(ResendApiLog.success.is_(False))
    result = await db.execute(q)
    return list(result.scalars().all())


def _empty_statistics(*, reason: str | None = None) -> ResendStatisticsResponse:
    summary: dict = {
        "total_emails_fetched": 0,
        "domains_total": 0,
        "domains_verified": 0,
        "contacts_fetched": 0,
        "broadcasts_total": 0,
        "delivered": 0,
        "opened": 0,
        "clicked": 0,
        "bounced": 0,
        "complained": 0,
        "failed": 0,
        "scheduled": 0,
        "last_fetched": datetime.now(timezone.utc).isoformat(),
    }
    if reason:
        summary["notice"] = reason
    return ResendStatisticsResponse(
        summary=summary,
        event_breakdown=[],
        domains=[],
        recent_emails=[],
        contacts_sample=[],
        broadcasts=[],
        api_usage=[],
    )


async def _safe_fetch_list(
    db: AsyncSession,
    config: ResendEmailConfig,
    api_key: str,
    path: str,
    *,
    max_items: int = 50,
) -> list[dict]:
    try:
        return await _fetch_list(
            db,
            config,
            api_key,
            path,
            max_items=max_items,
            soft_fail=True,
        )
    except HTTPException:
        logger.warning("Resend statistics fetch skipped for %s", path)
        return []
    except Exception:
        logger.warning("Resend statistics fetch failed for %s", path, exc_info=True)
        return []


def _build_statistics_response(
    config: ResendEmailConfig,
    *,
    emails: list[dict],
    domains: list[dict],
    contacts: list[dict],
    broadcasts: list[dict],
    api_logs: list[dict],
    notice: str | None = None,
) -> ResendStatisticsResponse:
    event_counts = Counter(
        (e.get("last_event") or "unknown") for e in emails if isinstance(e, dict)
    )
    event_breakdown = [{"event": k, "count": v} for k, v in event_counts.most_common()]
    domains_verified = sum(1 for d in domains if d.get("status") == "verified")
    fetched_at = datetime.now(timezone.utc)
    config.last_sync = fetched_at

    summary = {
        "total_emails_fetched": len(emails),
        "domains_total": len(domains),
        "domains_verified": domains_verified,
        "contacts_fetched": len(contacts),
        "broadcasts_total": len(broadcasts),
        "delivered": event_counts.get("delivered", 0),
        "opened": event_counts.get("opened", 0),
        "clicked": event_counts.get("clicked", 0),
        "bounced": event_counts.get("bounced", 0),
        "complained": event_counts.get("complained", 0),
        "failed": event_counts.get("failed", 0),
        "scheduled": event_counts.get("scheduled", 0),
        "last_fetched": fetched_at.isoformat(),
    }
    if notice:
        summary["notice"] = notice

    return ResendStatisticsResponse(
        summary=summary,
        event_breakdown=event_breakdown,
        domains=[
            {
                "id": d.get("id"),
                "name": d.get("name"),
                "status": d.get("status"),
                "region": d.get("region"),
                "created_at": d.get("created_at"),
                "capabilities": d.get("capabilities"),
            }
            for d in domains
            if isinstance(d, dict)
        ],
        recent_emails=[
            {
                "id": e.get("id"),
                "to": e.get("to"),
                "from": e.get("from"),
                "subject": e.get("subject"),
                "last_event": e.get("last_event"),
                "created_at": e.get("created_at"),
            }
            for e in emails[:25]
            if isinstance(e, dict)
        ],
        contacts_sample=[
            {
                "id": c.get("id"),
                "email": c.get("email"),
                "first_name": c.get("first_name"),
                "last_name": c.get("last_name"),
                "unsubscribed": c.get("unsubscribed"),
                "created_at": c.get("created_at"),
            }
            for c in contacts[:25]
            if isinstance(c, dict)
        ],
        broadcasts=[
            {
                "id": b.get("id"),
                "name": b.get("name"),
                "status": b.get("status"),
                "created_at": b.get("created_at"),
                "sent_at": b.get("sent_at"),
            }
            for b in broadcasts
            if isinstance(b, dict)
        ],
        api_usage=[
            {
                "id": log.get("id"),
                "endpoint": log.get("endpoint"),
                "method": log.get("method"),
                "response_status": log.get("response_status"),
                "created_at": log.get("created_at"),
            }
            for log in api_logs[:25]
            if isinstance(log, dict)
        ],
    )


async def get_statistics(db: AsyncSession) -> ResendStatisticsResponse:
    try:
        config = await get_config(db)
        api_key = decrypt_api_key(config.api_key)
        if not api_key:
            return _empty_statistics(reason="Configure your Resend API key to load statistics.")

        emails = await _safe_fetch_list(db, config, api_key, "/emails", max_items=100)
        domains = await _safe_fetch_list(db, config, api_key, "/domains", max_items=25)
        contacts = await _safe_fetch_list(db, config, api_key, "/contacts", max_items=25)
        broadcasts = await _safe_fetch_list(db, config, api_key, "/broadcasts", max_items=25)
        api_logs = await _safe_fetch_list(db, config, api_key, "/logs", max_items=25)

        notice: str | None = None
        if not any([emails, domains, contacts, broadcasts, api_logs]):
            notice = (
                "Could not load live Resend statistics. "
                "Verify your API key is valid and has permission to read email data."
            )

        result = _build_statistics_response(
            config,
            emails=emails,
            domains=domains,
            contacts=contacts,
            broadcasts=broadcasts,
            api_logs=api_logs,
            notice=notice,
        )
        _sync_runtime_cache(config)
        return result
    except Exception:
        logger.exception("Resend statistics aggregation failed")
        return _empty_statistics(
            reason="Unable to load Resend statistics right now. Try again shortly.",
        )


async def list_emails(
    db: AsyncSession,
    *,
    limit: int = 50,
) -> list[dict]:
    config = await get_config(db)
    api_key = _resolve_api_key(config)
    return await _fetch_list(db, config, api_key, "/emails", max_items=limit)


async def list_domains(db: AsyncSession) -> list[dict]:
    config = await get_config(db)
    api_key = _resolve_api_key(config)
    return await _fetch_list(db, config, api_key, "/domains", max_items=50)