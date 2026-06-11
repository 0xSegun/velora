"""
Unified email delivery — Resend, SMTP, or console/file fallback for development.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import resend

from app.config import get_settings
from app.services.resend_service import (
    get_runtime_api_key,
    get_runtime_from_email,
    get_runtime_reply_to,
    get_runtime_tracking,
)

logger = logging.getLogger(__name__)
settings = get_settings()
BACKEND_ROOT = Path(__file__).resolve().parents[2]
EMAIL_LOG_DIR = BACKEND_ROOT / "logs"


def _resolve_from_address() -> str:
    runtime_from = get_runtime_from_email()
    if runtime_from:
        return runtime_from
    if settings.EMAIL_FROM:
        return settings.EMAIL_FROM
    if settings.RESEND_FROM_EMAIL:
        return settings.RESEND_FROM_EMAIL
    host = settings.FRONTEND_URL.split("//")[-1].split(":")[0]
    return f"{settings.APP_NAME} <noreply@{host}>"


def _resolve_provider() -> str:
    mode = (settings.EMAIL_MODE or "auto").lower()
    if mode in {"console", "smtp", "resend"}:
        return mode
    if get_runtime_api_key() or settings.RESEND_API_KEY:
        return "resend"
    if settings.EMAIL_HOST:
        return "smtp"
    return "console"


def _email_shell(title: str, body_html: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    cta = ""
    if cta_label and cta_url:
        cta = (
            f'<p style="margin:24px 0;">'
            f'<a href="{cta_url}" style="display:inline-block;padding:12px 24px;'
            f'background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">'
            f"{cta_label}</a></p>"
        )
    return f"""
    <div style="font-family:Inter,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#111;">
      <div style="padding:24px;border:1px solid #e5e5e5;border-radius:12px;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;">
          {settings.APP_NAME}
        </p>
        <h1 style="margin:0 0 16px;font-size:22px;">{title}</h1>
        <div style="font-size:15px;line-height:1.6;color:#333;">{body_html}</div>
        {cta}
        <p style="margin-top:24px;font-size:12px;color:#888;">
          If you did not request this email, you can safely ignore it.
        </p>
      </div>
    </div>
    """


def _write_console_log(to: str, subject: str, html: str) -> None:
    EMAIL_LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_to = to.replace("@", "_at_")
    path = EMAIL_LOG_DIR / f"email_{stamp}_{safe_to}.html"
    path.write_text(
        f"<!-- To: {to} | Subject: {subject} -->\n{html}",
        encoding="utf-8",
    )
    logger.info("Email logged to %s (to=%s, subject=%s)", path, to, subject)


async def send_email(*, to: str, subject: str, html: str) -> bool:
    """Send an email using the configured provider. Returns True on success."""
    provider = _resolve_provider()
    from_addr = _resolve_from_address()

    try:
        if provider == "console":
            _write_console_log(to, subject, html)
            logger.info("[console email] to=%s subject=%s", to, subject)
            return True

        if provider == "resend":
            api_key = get_runtime_api_key() or settings.RESEND_API_KEY
            if not api_key:
                logger.warning("RESEND_API_KEY missing — falling back to console")
                _write_console_log(to, subject, html)
                return True
            resend.api_key = api_key
            reply_to = get_runtime_reply_to()
            open_tracking, click_tracking = get_runtime_tracking()

            def _send_resend() -> None:
                payload: dict = {
                    "from": from_addr,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                }
                if reply_to:
                    payload["reply_to"] = reply_to
                payload["open_tracking"] = open_tracking
                payload["click_tracking"] = click_tracking
                resend.Emails.send(payload)

            await asyncio.to_thread(_send_resend)
            return True

        if provider == "smtp":
            if not settings.EMAIL_HOST:
                logger.warning("EMAIL_HOST missing — falling back to console")
                _write_console_log(to, subject, html)
                return True

            def _send_smtp() -> None:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = from_addr
                msg["To"] = to
                msg.attach(MIMEText(html, "html", "utf-8"))

                with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=30) as server:
                    if settings.EMAIL_USE_TLS:
                        server.starttls()
                    if settings.EMAIL_USERNAME and settings.EMAIL_PASSWORD:
                        server.login(settings.EMAIL_USERNAME, settings.EMAIL_PASSWORD)
                    server.sendmail(from_addr, [to], msg.as_string())

            await asyncio.to_thread(_send_smtp)
            return True

        _write_console_log(to, subject, html)
        return True
    except Exception:
        logger.exception("Failed to send email to %s (subject=%s)", to, subject)
        return False


async def send_welcome_email(*, to: str, name: str, verify_url: str) -> bool:
    html = _email_shell(
        f"Welcome to {settings.APP_NAME}",
        (
            f"<p>Hi {name},</p>"
            f"<p>Your account has been created. Verify your email to unlock the full platform, "
            f"or sign in right away to explore the dashboard.</p>"
        ),
        "Verify email address",
        verify_url,
    )
    return await send_email(to=to, subject=f"Welcome to {settings.APP_NAME}", html=html)


async def send_password_reset_email(*, to: str, reset_url: str) -> bool:
    html = _email_shell(
        "Reset your password",
        "<p>We received a request to reset your password. This link expires in 15 minutes.</p>",
        "Reset password",
        reset_url,
    )
    return await send_email(to=to, subject=f"{settings.APP_NAME} — Password Reset", html=html)


async def send_password_changed_email(*, to: str, name: str) -> bool:
    html = _email_shell(
        "Password updated",
        (
            f"<p>Hi {name},</p>"
            f"<p>Your {settings.APP_NAME} password was changed successfully. "
            f"If this wasn't you, contact support immediately.</p>"
        ),
    )
    return await send_email(to=to, subject=f"{settings.APP_NAME} — Password Changed", html=html)


async def send_profile_updated_email(*, to: str, name: str) -> bool:
    html = _email_shell(
        "Profile updated",
        (
            f"<p>Hi {name},</p>"
            f"<p>Your profile settings were saved successfully.</p>"
        ),
    )
    return await send_email(to=to, subject=f"{settings.APP_NAME} — Profile Updated", html=html)


async def send_prediction_ready_email(
    *,
    to: str,
    name: str,
    country_code: str,
    inflation_rate: float,
    dashboard_url: str,
) -> bool:
    html = _email_shell(
        "Forecast ready",
        (
            f"<p>Hi {name},</p>"
            f"<p>Your inflation forecast for <strong>{country_code}</strong> is ready.</p>"
            f"<p>Predicted rate: <strong>{inflation_rate:.2f}%</strong></p>"
        ),
        "View forecast",
        dashboard_url,
    )
    return await send_email(to=to, subject=f"{settings.APP_NAME} — Forecast Ready", html=html)


async def send_account_deactivated_email(*, to: str, name: str) -> bool:
    html = _email_shell(
        "Account deactivated",
        (
            f"<p>Hi {name},</p>"
            f"<p>Your {settings.APP_NAME} account has been deactivated by an administrator. "
            f"Contact support if you believe this is a mistake.</p>"
        ),
    )
    return await send_email(to=to, subject=f"{settings.APP_NAME} — Account Deactivated", html=html)


async def send_role_changed_email(*, to: str, name: str, role: str) -> bool:
    html = _email_shell(
        "Account role updated",
        (
            f"<p>Hi {name},</p>"
            f"<p>Your account role has been updated to <strong>{role}</strong>.</p>"
        ),
    )
    return await send_email(to=to, subject=f"{settings.APP_NAME} — Role Updated", html=html)


async def send_admin_new_user_email(*, admin_email: str, user_email: str, user_name: str) -> bool:
    html = _email_shell(
        "New user registration",
        (
            f"<p>A new user registered on {settings.APP_NAME}.</p>"
            f"<p><strong>{user_name}</strong> ({user_email})</p>"
        ),
    )
    return await send_email(
        to=admin_email,
        subject=f"{settings.APP_NAME} — New User Registered",
        html=html,
    )