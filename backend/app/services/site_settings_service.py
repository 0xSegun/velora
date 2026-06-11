"""
Central site settings — CMS, SEO, branding, dashboard copy, and legal content.
"""

from __future__ import annotations

import copy
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site_settings import SiteSettings

# ── Setting keys ──────────────────────────────────────────────────────────────

CMS_CONTENT_KEY = "cms_content"
SEO_SETTINGS_KEY = "seo_settings"
BRANDING_SETTINGS_KEY = "branding_settings"
GENERAL_SETTINGS_KEY = "general_settings"
DASHBOARD_SETTINGS_KEY = "dashboard_settings"
LEGAL_CONTENT_KEY = "legal_content"

PUBLIC_KEYS = (
    CMS_CONTENT_KEY,
    SEO_SETTINGS_KEY,
    BRANDING_SETTINGS_KEY,
    GENERAL_SETTINGS_KEY,
    DASHBOARD_SETTINGS_KEY,
    LEGAL_CONTENT_KEY,
)

# ── Defaults (match current production landing page) ──────────────────────────

DEFAULT_CMS_CONTENT: dict[str, Any] = {
    "navbar": {
        "brandEmoji": "🔮",
        "brandName": "Velora",
        "ctaLabel": "Start Predicting",
        "links": [
            {"label": "Features", "href": "#features"},
            {"label": "How It Works", "href": "#how-it-works"},
            {"label": "Intelligence", "href": "#intelligence"},
            {"label": "Dashboard", "href": "#dashboard"},
            {"label": "FAQ", "href": "#faq"},
        ],
    },
    "hero": {
        "badge": "AI-Powered Economic Intelligence",
        "headlineBefore": "Predict",
        "headlineHighlight": "Inflation",
        "headlineAfter": "Before It Happens.",
        "subtitle": (
            "Harness the power of TS-Transformer AI models to forecast inflation "
            "trends, analyze CPI movements, and predict economic fluctuations with "
            "unprecedented accuracy."
        ),
        "primaryCta": "Start Predicting",
        "secondaryCta": "View Live Dashboard",
        "stats": [
            {"value": "99.2%", "label": "Accuracy"},
            {"value": "150+", "label": "Countries"},
            {"value": "10M+", "label": "Predictions"},
        ],
    },
    "features": {
        "eyebrow": "Capabilities",
        "title": "Everything you need to forecast inflation",
        "subtitle": (
            "A complete economic intelligence stack — from raw data ingestion "
            "to publication-ready reports."
        ),
        "items": [
            {
                "icon": "Brain",
                "title": "AI Prediction Engine",
                "description": (
                    "Advanced TS-Transformer models analyze economic patterns and "
                    "predict inflation trends with 99%+ accuracy."
                ),
            },
            {
                "icon": "BarChart3",
                "title": "Real-time Analytics",
                "description": (
                    "Live dashboard with CPI tracking, GDP analytics, and "
                    "comprehensive economic indicators updated in real-time."
                ),
            },
            {
                "icon": "Shield",
                "title": "Risk Assessment",
                "description": (
                    "Automated deflation risk scoring and economic stability "
                    "monitoring with confidence intervals."
                ),
            },
            {
                "icon": "Globe",
                "title": "Country Comparison",
                "description": (
                    "Compare inflation trends across 150+ countries with "
                    "interactive charts and detailed analysis."
                ),
            },
            {
                "icon": "Bell",
                "title": "Smart Alerts",
                "description": (
                    "Get notified when economic indicators cross critical "
                    "thresholds or predictions change significantly."
                ),
            },
            {
                "icon": "FileText",
                "title": "Export Reports",
                "description": (
                    "Generate professional PDF/CSV reports for academic research, "
                    "presentations, and policy analysis."
                ),
            },
        ],
    },
    "howItWorks": {
        "eyebrow": "Workflow",
        "title": "From data to decision in four steps",
        "subtitle": "Our pipeline ingests, models, validates, and delivers actionable forecasts.",
        "steps": [
            {
                "step": "01",
                "title": "Ingest Economic Data",
                "description": "Aggregate CPI, GDP, interest rates, and FX from FRED, CBN, NBS, and 20+ sources.",
            },
            {
                "step": "02",
                "title": "Train TS-Transformer",
                "description": "Neural networks learn temporal patterns across decades of macroeconomic history.",
            },
            {
                "step": "03",
                "title": "Validate & Score",
                "description": "Back-test against holdout periods; confidence intervals and risk levels assigned.",
            },
            {
                "step": "04",
                "title": "Deliver Insights",
                "description": "Interactive dashboards, alerts, and exportable reports for your team.",
            },
        ],
    },
    "intelligence": {
        "eyebrow": "Intelligence Layer",
        "title": "Beyond predictions — full economic intelligence",
        "subtitle": "News sentiment, event impact, and explainability built into every forecast.",
        "highlights": [
            {"title": "News Sentiment", "description": "Real-time macro news scoring weighted into forecasts.", "value": "15%"},
            {"title": "Event Impact", "description": "Policy shocks and calendar events modeled automatically.", "value": "20%"},
            {"title": "Explainability", "description": "SHAP-style feature attribution for every prediction.", "value": "100%"},
            {"title": "Scenario Engine", "description": "Stress-test inflation under custom macro assumptions.", "value": "∞"},
            {"title": "Auto-Retrain", "description": "Models refresh when accuracy drops below threshold.", "value": "Weekly"},
        ],
    },
    "trustedBy": {
        "title": "Trusted by economists and institutions worldwide",
        "institutions": [
            "Central Bank of Nigeria",
            "World Bank",
            "IMF",
            "African Development Bank",
            "GTBank",
            "University of Lagos",
            "Stanbic IBTC",
            "Lagos Business School",
        ],
    },
    "statistics": {
        "items": [
            {"value": "10M+", "label": "Predictions Generated"},
            {"value": "99.2%", "label": "Model Accuracy"},
            {"value": "150+", "label": "Countries Covered"},
            {"value": "50K+", "label": "Active Users"},
        ],
    },
    "livePreview": {
        "eyebrow": "Live Metrics",
        "title": "Real-time economic snapshot",
        "metrics": [
            {"label": "Nigeria CPI", "value": "22.79%", "change": "+0.4%", "trend": "up"},
            {"label": "Deflation Risk", "value": "Low", "change": "Stable", "trend": "neutral"},
            {"label": "Model Confidence", "value": "97.3%", "change": "+1.2%", "trend": "up"},
            {"label": "Trend Direction", "value": "Rising", "change": "3-month", "trend": "up"},
        ],
    },
    "dashboardPreview": {
        "eyebrow": "Platform Preview",
        "title": "Your command center for inflation intelligence",
        "subtitle": "Monitor KPIs, compare countries, and drill into predictions — all in one glass UI.",
        "mockUrl": "velora.io/dashboard",
    },
    "testimonials": {
        "eyebrow": "Testimonials",
        "title": "What economists and researchers say",
        "items": [
            {
                "quote": "Velora gave us a 6-week lead on inflation shifts that traditional models missed entirely.",
                "author": "Dr. Fatima Adeyemi",
                "title": "Senior Economist, CBN",
            },
            {
                "quote": "The explainability layer alone justified our enterprise license — regulators love the transparency.",
                "author": "James Okafor",
                "title": "Head of Risk, Stanbic IBTC",
            },
            {
                "quote": "We published three papers using Velora exports. The data quality is exceptional.",
                "author": "Prof. Ngozi Eze",
                "title": "Economics, University of Lagos",
            },
        ],
    },
    "faq": {
        "eyebrow": "FAQ",
        "title": "Frequently asked questions",
        "subtitle": "Everything you need to know about Velora.",
        "items": [
            {
                "question": "How accurate are Velora predictions?",
                "answer": "Our TS-Transformer achieves 99.2% accuracy on historical back-tests across all supported countries, with confidence intervals on every forecast.",
            },
            {
                "question": "Which countries are supported?",
                "answer": "We cover 150+ economies with deep data for Nigeria, Ghana, Kenya, South Africa, Egypt, and expanding African markets.",
            },
            {
                "question": "How often are predictions updated?",
                "answer": "Forecasts refresh daily as new economic data arrives. Models retrain automatically when accuracy drops below your configured threshold.",
            },
            {
                "question": "Can I export data and reports?",
                "answer": "Yes — export predictions, charts, and full reports to CSV, PDF, or via our REST API for integration into your workflows.",
            },
            {
                "question": "Is there a free trial?",
                "answer": "Start free with full platform access. No credit card required for the trial period.",
            },
            {
                "question": "How is my data secured?",
                "answer": "AES-256 at rest, TLS 1.3 in transit, role-based access control, and audit logging for enterprise compliance.",
            },
        ],
    },
    "cta": {
        "title": "Ready to predict inflation before it happens?",
        "subtitle": "Join economists, banks, and researchers using Velora to stay ahead of macro trends.",
        "primaryCta": "Get Started Free",
        "secondaryCta": "View Dashboard",
        "footnote": "No credit card required",
    },
    "footer": {
        "tagline": "AI-powered inflation intelligence for the world.",
        "copyright": "© {year} Velora. All rights reserved.",
        "columns": [
            {
                "title": "Product",
                "links": [
                    {"label": "Predictions", "href": "/dashboard/predictions"},
                    {"label": "Dashboard", "href": "/dashboard"},
                    {"label": "Intelligence", "href": "/dashboard/intelligence"},
                    {"label": "Analytics", "href": "/dashboard/analytics"},
                    {"label": "Reports", "href": "/dashboard/reports"},
                ],
            },
            {
                "title": "Resources",
                "links": [
                    {"label": "How It Works", "href": "/#how-it-works"},
                    {"label": "Research Papers", "href": "/dashboard/research"},
                    {"label": "FAQ", "href": "/#faq"},
                    {"label": "Features", "href": "/#features"},
                ],
            },
            {
                "title": "Company",
                "links": [
                    {"label": "About", "href": "/#features"},
                    {"label": "Contact", "href": "/#get-started"},
                    {"label": "Partners", "href": "/#dashboard"},
                    {"label": "Careers", "href": "/#get-started"},
                ],
            },
            {
                "title": "Legal",
                "links": [
                    {"label": "Privacy Policy", "href": "/privacy"},
                    {"label": "Terms of Service", "href": "/terms"},
                    {"label": "Cookie Policy", "href": "/privacy"},
                ],
            },
        ],
    },
}

DEFAULT_SEO_SETTINGS: dict[str, Any] = {
    "metaTitle": "Velora | AI-Powered Inflation & Deflation Prediction Platform",
    "metaDescription": (
        "Harness the power of AI and machine learning to forecast inflation trends, "
        "analyze CPI movements, and predict economic fluctuations with unprecedented accuracy."
    ),
    "keywords": (
        "inflation prediction, AI forecasting, CPI analysis, economic intelligence, "
        "deflation risk, Nigeria economy, machine learning, financial analytics"
    ),
    "ogImage": "",
    "twitterImage": "",
    "ogTitle": "Velora | AI-Powered Inflation Prediction",
    "ogDescription": "Predict inflation before it happens with AI-driven economic forecasting.",
    "twitterCard": "summary_large_image",
    "twitterSite": "@velora",
    "canonicalUrl": "",
    "robots": "index, follow",
    "googleAnalyticsId": "",
    "googleTagManagerId": "",
    "plausibleDomain": "",
    "structuredDataEnabled": True,
    "sitemapEnabled": True,
}

DEFAULT_BRANDING: dict[str, Any] = {
    "siteName": "Velora",
    "siteDesc": "AI-Powered Inflation Prediction Platform",
    "primaryColor": "#FFFFFF",
    "logoUrl": "",
    "faviconUrl": "",
    "fontSans": "Inter",
    "fontDisplay": "Outfit",
    "fontMono": "JetBrains Mono",
}

DEFAULT_GENERAL: dict[str, Any] = {
    "defaultCountry": "NG",
    "defaultLang": "en",
    "enableRegistration": True,
    "maintenance": False,
    "maintenanceMessage": "We are performing scheduled maintenance. Please check back shortly.",
    "supportEmail": "support@velora.io",
}

DEFAULT_DASHBOARD: dict[str, Any] = {
    "overviewTitle": "Economic Overview",
    "overviewSubtitle": "Real-time inflation intelligence at a glance",
    "predictionsTitle": "Inflation Predictions",
    "predictionsSubtitle": "AI-powered forecasts across your tracked countries",
    "analyticsTitle": "Analytics",
    "analyticsSubtitle": "Deep-dive into trends, accuracy, and model performance",
    "intelligenceTitle": "Economic Intelligence",
    "intelligenceSubtitle": "News, events, and sentiment driving macro outcomes",
    "reportsTitle": "Reports",
    "reportsSubtitle": "Generate and export professional economic reports",
    "welcomeMessage": "Welcome back — here's your latest economic snapshot.",
    "emptyPredictions": "No predictions yet. Run your first forecast to get started.",
    "emptyReports": "No reports generated. Create one from the reports page.",
}

DEFAULT_LEGAL: dict[str, Any] = {
    "privacyTitle": "Privacy Policy",
    "privacyLastUpdated": "June 2026",
    "privacyContent": (
        "Velora respects your privacy. We collect only data necessary to provide "
        "inflation forecasting services, secure your account, and improve our models. "
        "We do not sell personal data to third parties."
    ),
    "termsTitle": "Terms of Service",
    "termsLastUpdated": "June 2026",
    "termsContent": (
        "By using Velora you agree to our acceptable use policy. Predictions are "
        "provided for informational purposes and do not constitute financial advice."
    ),
}

DEFAULTS: dict[str, dict[str, Any]] = {
    CMS_CONTENT_KEY: DEFAULT_CMS_CONTENT,
    SEO_SETTINGS_KEY: DEFAULT_SEO_SETTINGS,
    BRANDING_SETTINGS_KEY: DEFAULT_BRANDING,
    GENERAL_SETTINGS_KEY: DEFAULT_GENERAL,
    DASHBOARD_SETTINGS_KEY: DEFAULT_DASHBOARD,
    LEGAL_CONTENT_KEY: DEFAULT_LEGAL,
}

CATEGORY_MAP = {
    CMS_CONTENT_KEY: "cms",
    SEO_SETTINGS_KEY: "seo",
    BRANDING_SETTINGS_KEY: "branding",
    GENERAL_SETTINGS_KEY: "general",
    DASHBOARD_SETTINGS_KEY: "dashboard",
    LEGAL_CONTENT_KEY: "legal",
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base."""
    result = copy.deepcopy(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


async def _load_settings_map(db: AsyncSession, keys: tuple[str, ...]) -> dict[str, dict]:
    result = await db.execute(
        select(SiteSettings).where(SiteSettings.key.in_(keys))
    )
    rows = result.scalars().all()
    return {row.key: row.value if isinstance(row.value, dict) else {} for row in rows}


async def get_public_settings(db: AsyncSession) -> dict[str, Any]:
    """Merged public settings — no credentials or secrets."""
    stored = await _load_settings_map(db, PUBLIC_KEYS)
    return {
        "cms": _deep_merge(DEFAULT_CMS_CONTENT, stored.get(CMS_CONTENT_KEY, {})),
        "seo": _deep_merge(DEFAULT_SEO_SETTINGS, stored.get(SEO_SETTINGS_KEY, {})),
        "branding": _deep_merge(DEFAULT_BRANDING, stored.get(BRANDING_SETTINGS_KEY, {})),
        "general": _deep_merge(DEFAULT_GENERAL, stored.get(GENERAL_SETTINGS_KEY, {})),
        "dashboard": _deep_merge(DEFAULT_DASHBOARD, stored.get(DASHBOARD_SETTINGS_KEY, {})),
        "legal": _deep_merge(DEFAULT_LEGAL, stored.get(LEGAL_CONTENT_KEY, {})),
    }


async def get_admin_settings_bundle(db: AsyncSession) -> dict[str, Any]:
    """Full settings bundle for admin UI."""
    public = await get_public_settings(db)
    return {
        **public,
        "credentials": {
            "fredKey": "",
            "resendKey": "",
            "resendFrom": "noreply@velora.io",
        },
    }


async def update_settings_section(
    db: AsyncSession,
    key: str,
    value: dict,
    admin_id,
) -> dict:
    """Upsert a single settings section."""
    if key not in DEFAULTS:
        raise ValueError(f"Unknown settings key: {key}")

    merged = _deep_merge(DEFAULTS[key], value)
    result = await db.execute(select(SiteSettings).where(SiteSettings.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = merged
        row.updated_by = admin_id
    else:
        db.add(
            SiteSettings(
                key=key,
                value=merged,
                category=CATEGORY_MAP[key],
                updated_by=admin_id,
            )
        )
    await db.flush()
    return merged


async def update_settings_bundle(
    db: AsyncSession,
    payload: dict[str, dict],
    admin_id,
) -> list[str]:
    """Update multiple settings sections at once."""
    key_map = {
        "cms": CMS_CONTENT_KEY,
        "seo": SEO_SETTINGS_KEY,
        "branding": BRANDING_SETTINGS_KEY,
        "general": GENERAL_SETTINGS_KEY,
        "dashboard": DASHBOARD_SETTINGS_KEY,
        "legal": LEGAL_CONTENT_KEY,
    }
    updated: list[str] = []
    for section, data in payload.items():
        if section not in key_map or not isinstance(data, dict):
            continue
        await update_settings_section(db, key_map[section], data, admin_id)
        updated.append(section)
    return updated


async def seed_default_site_settings(db: AsyncSession) -> None:
    """Ensure default settings rows exist on first boot."""
    for key, default_value in DEFAULTS.items():
        result = await db.execute(select(SiteSettings).where(SiteSettings.key == key))
        if result.scalar_one_or_none() is None:
            db.add(
                SiteSettings(
                    key=key,
                    value=copy.deepcopy(default_value),
                    category=CATEGORY_MAP[key],
                )
            )
    await db.flush()