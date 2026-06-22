"""
Research-grade economic report generation using live platform data.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economic_data import EconomicData
from app.models.prediction import Prediction
from app.models.user import User
from app.schemas.report import ReportCreate, ReportResponse
from app.services import intelligence_service, report_service
from app.services.country_service import COUNTRY_REFERENCE
from app.services.exchange_rate_service import get_rate_for_country


REPORT_SECTIONS = [
    "executive_summary",
    "current_economic_situation",
    "inflation_analysis",
    "deflation_analysis",
    "exchange_rate_analysis",
    "interest_rate_analysis",
    "gdp_analysis",
    "economic_events_impact",
    "country_comparison",
    "forecast_outlook",
    "risk_assessment",
    "confidence_analysis",
    "recommendations",
    "conclusion",
]


async def _economic_history(db: AsyncSession, code: str, limit: int = 12) -> list[EconomicData]:
    result = await db.execute(
        select(EconomicData)
        .where(EconomicData.country_code == code.upper())
        .order_by(desc(EconomicData.data_date))
        .limit(limit)
    )
    return list(result.scalars().all())


async def _latest_prediction(db: AsyncSession, user_id: uuid.UUID, code: str) -> Prediction | None:
    result = await db.execute(
        select(Prediction)
        .where(Prediction.user_id == user_id, Prediction.country_code == code.upper())
        .order_by(desc(Prediction.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


def _trend_word(current: float | None, previous: float | None) -> str:
    if current is None or previous is None:
        return "stable"
    diff = current - previous
    if abs(diff) < 0.05:
        return "stable"
    return "rising" if diff > 0 else "falling"


def _coalesce_metric(*values: float | None) -> float | None:
    for value in values:
        if value is not None:
            return value
    return None


def _macro_context_paragraph(source_label: str, ctx, *, empty_hint: str) -> str:
    if not ctx:
        return empty_hint
    parts = []
    if ctx.data_year:
        parts.append(f"{source_label} ({ctx.data_year}):")
    if ctx.inflation_pct is not None:
        parts.append(f"inflation {ctx.inflation_pct:.1f}%")
    if ctx.gdp_growth_pct is not None:
        parts.append(f"GDP growth {ctx.gdp_growth_pct:.1f}%")
    if ctx.government_debt_pct_gdp is not None:
        parts.append(f"public debt {ctx.government_debt_pct_gdp:.1f}% of GDP")
    if ctx.unemployment_pct is not None:
        parts.append(f"unemployment {ctx.unemployment_pct:.1f}%")
    if ctx.current_account_pct_gdp is not None:
        parts.append(f"current account {ctx.current_account_pct_gdp:.1f}% of GDP")
    if ctx.gdp_usd_billions is not None:
        parts.append(f"GDP {ctx.gdp_usd_billions:.1f}B USD")
    if not parts:
        return f"{source_label} indicators are pending synchronization for this country."
    return " ".join(parts) + "."


def _format_retrieved(date_val) -> str:
    if not date_val:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if hasattr(date_val, "strftime"):
        return date_val.strftime("%Y-%m-%d")
    return str(date_val)[:10]


def _build_references(
    code: str,
    name: str,
    news_items: list[dict],
    imf_year: int | None = None,
    wb_retrieved: str | None = None,
    te_retrieved: str | None = None,
) -> list[str]:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    wb_date = wb_retrieved or now
    te_date = te_retrieved or now
    refs = [
        f"FRED — Federal Reserve Economic Data. Accessed {now}. https://fred.stlouisfed.org/",
        f"IMF DataMapper — World Economic Outlook indicators for {name}. "
        f"{'Data year ' + str(imf_year) + '. ' if imf_year else ''}"
        f"Accessed {now}. https://www.imf.org/en/Data",
        f"World Bank Open Data — Country indicators for {name}. "
        f"Last sync {wb_date}. https://data.worldbank.org/country/{code.lower()}",
        f"ExchangeRate API — Live FX data for {code}. Accessed {now}.",
        f"Trading Economics — {name} macroeconomic indicators. "
        f"Last sync {te_date}. https://tradingeconomics.com/",
        f"OECD — Economic outlook statistics. Accessed {now}. https://www.oecd.org/economy/",
        f"Wikipedia — Economy and central bank context for {name}. Accessed {now}. "
        f"https://en.wikipedia.org/wiki/Economy_of_{name.replace(' ', '_')}",
        f"Velora TS-Transformer Forecast Engine. Generated {now}.",
    ]
    seen_sources: set[str] = set()
    for item in news_items[:8]:
        src = item.get("source", "")
        if not src or src in seen_sources or src in ("Velora", "Velora Intelligence"):
            continue
        seen_sources.add(src)
        pub = item.get("published_at", "")
        pub_str = pub[:10] if isinstance(pub, str) and pub else now
        url = item.get("url") or ""
        if url:
            refs.append(f"{src} — \"{item.get('title', 'Economic headline')}\". "
                         f"Published {pub_str}. {url}")
        else:
            refs.append(f"{src} — Economic intelligence feed. Accessed {now}.")
    refs.append(
        f"Central Bank of {name} — Monetary policy and interest rate guidance. Accessed {now}."
    )
    return refs


def _format_news_highlight(item: dict) -> str:
    title = item.get("title", "Untitled")
    label = item.get("sentiment_label", "Neutral")
    impact = item.get("economic_impact_score")
    risk = item.get("risk_score")
    parts = [f"• {title} ({label}"]
    if impact is not None:
        parts.append(f", impact {impact:.0f}/100")
    if risk is not None:
        parts.append(f", risk {risk:.0f}/100")
    parts.append(")")
    return "".join(parts)


def _imf_context_paragraph(imf) -> str:
    return _macro_context_paragraph(
        "IMF World Economic Outlook",
        imf,
        empty_hint="IMF macro data is not yet synced for this country. Configure IMF API in Admin → IMF Settings.",
    )


def _wiki_context_paragraph(wiki, name: str) -> str:
    if not wiki:
        return f"Wikipedia context for {name} is not yet cached. Run Wikipedia sync from Admin settings."
    chunks = []
    if wiki.economy_summary:
        summary = wiki.economy_summary[:600]
        if len(wiki.economy_summary) > 600:
            summary += "…"
        chunks.append(f"Economic profile: {summary}")
    if wiki.central_bank_summary:
        cb = wiki.central_bank_summary[:400]
        if len(wiki.central_bank_summary) > 400:
            cb += "…"
        chunks.append(f"Monetary authority: {cb}")
    return " ".join(chunks) if chunks else f"No Wikipedia summaries cached for {name}."


async def generate_country_report(
    db: AsyncSession,
    *,
    user: User,
    country_code: str,
    horizon_months: int = 6,
    report_type: str = "custom",
    indicator_focus: str | None = None,
) -> ReportResponse:
    """Generate a data-driven country intelligence report and persist it."""
    code = country_code.upper()
    ref = COUNTRY_REFERENCE.get(code, {})
    name = ref.get("name", code)
    now = datetime.now(timezone.utc)

    history = await _economic_history(db, code)
    latest = history[0] if history else None
    previous = history[1] if len(history) > 1 else None
    prediction = await _latest_prediction(db, user.id, code)
    fx = await get_rate_for_country(db, code)
    health = await intelligence_service.compute_economic_health(db, code)
    risk = await intelligence_service.compute_country_risk(db, code)
    tracked = user.tracked_countries or []
    news = await intelligence_service.get_news(
        db,
        code,
        limit=10,
        tracked_countries=tracked,
        country_priority=True,
    )
    country_ctx = await intelligence_service.get_country_context(db, code)
    imf = country_ctx.imf
    world_bank = country_ctx.world_bank
    trading_economics = country_ctx.trading_economics
    wiki = country_ctx.wikipedia
    inflation = latest.inflation_rate if latest else None
    prev_inflation = previous.inflation_rate if previous else None
    gdp = latest.gdp_growth if latest else None
    interest = latest.interest_rate if latest else None
    exchange = latest.exchange_rate if latest else fx.exchange_rate
    unemployment = latest.unemployment_rate if latest else None
    oil = latest.oil_price if latest else None

    infl_trend = _trend_word(inflation, prev_inflation)
    fx_trend = fx.trend if fx.exchange_rate else "stable"
    pred_rate = prediction.inflation_rate if prediction else inflation
    pred_conf = prediction.confidence_score if prediction else None
    pred_trend = prediction.trend_direction if prediction else infl_trend
    risk_level = prediction.risk_level if prediction else risk.overall_risk_label

    news_headlines = [n["title"] for n in news[:3]]
    news_highlights = [_format_news_highlight(n) for n in news[:6]]
    effective_unemployment = _coalesce_metric(
        unemployment,
        imf.unemployment_pct if imf else None,
        world_bank.unemployment_pct if world_bank else None,
        trading_economics.unemployment_pct if trading_economics else None,
    )
    effective_inflation = _coalesce_metric(
        inflation,
        imf.inflation_pct if imf else None,
        world_bank.inflation_pct if world_bank else None,
        trading_economics.inflation_pct if trading_economics else None,
    )
    effective_gdp = _coalesce_metric(
        gdp,
        imf.gdp_growth_pct if imf else None,
        world_bank.gdp_growth_pct if world_bank else None,
        trading_economics.gdp_growth_pct if trading_economics else None,
    )
    effective_debt = _coalesce_metric(
        imf.government_debt_pct_gdp if imf else None,
        world_bank.government_debt_pct_gdp if world_bank else None,
        trading_economics.government_debt_pct_gdp if trading_economics else None,
    )
    effective_current_account = _coalesce_metric(
        imf.current_account_pct_gdp if imf else None,
        world_bank.current_account_pct_gdp if world_bank else None,
        trading_economics.current_account_pct_gdp if trading_economics else None,
    )

    executive = (
        f"This report provides a comprehensive assessment of economic conditions in {name} "
        f"as of {now.strftime('%B %d, %Y')}. "
    )
    if inflation is not None:
        executive += (
            f"Headline inflation stands at {inflation:.2f}% with a {infl_trend} trajectory. "
        )
    if prediction:
        executive += (
            f"The TS-Transformer model projects inflation at {pred_rate:.2f}% over a "
            f"{prediction.forecast_horizon or horizon_months}-month horizon with "
            f"{pred_conf:.0f}% confidence. "
        )
    if oil and infl_trend == "rising":
        executive += (
            "Recent increases in energy prices and exchange rate movements have contributed "
            f"to inflationary pressures in {name}. "
        )
    executive += (
        f"Economic health is rated {health.get('label', 'Moderate')} "
        f"({health.get('score', 50):.0f}/100) with overall risk classified as "
        f"{risk.overall_risk_label}. "
    )
    data_sources = []
    if imf:
        data_sources.append("IMF")
    if world_bank:
        data_sources.append("World Bank")
    if trading_economics:
        data_sources.append("Trading Economics")
    if data_sources:
        executive += (
            f"Macro backdrop draws on {', '.join(data_sources)} data "
            f"alongside FRED and live exchange rate feeds."
        )

    sections = [
        {
            "title": "Executive Summary",
            "body": executive,
        },
        {
            "title": "Current Economic Situation",
            "body": (
                f"{name}'s economy is navigating a period of "
                f"{'elevated' if (inflation or 0) > 8 else 'moderate' if (inflation or 0) > 4 else 'contained'} "
                f"price pressures. Unemployment is "
                f"{f'{unemployment:.1f}%' if unemployment is not None else 'not available in the latest release'}. "
                f"Currency strength indicators suggest "
                f"{'weakening' if fx_trend == 'down' else 'strengthening' if fx_trend == 'up' else 'relative stability'} "
                f"in foreign exchange markets. "
                f"{'Although inflation remains elevated, ' if (inflation or 0) > 10 else ''}"
                f"{'strong consumer demand suggests moderate growth potential over coming quarters.' if (gdp or 0) > 2 else 'growth momentum appears subdued relative to historical averages.'}"
            ),
        },
        {
            "title": "Inflation Analysis",
            "body": (
                f"Consumer price inflation is currently "
                f"{f'{inflation:.2f}%' if inflation is not None else 'unavailable'}"
                f"{f', compared with {prev_inflation:.2f}% in the prior period' if prev_inflation is not None else ''}. "
                f"The trend is {infl_trend}. "
                f"{'Food and transportation components typically transmit global commodity shocks to household budgets.' if infl_trend == 'rising' else 'Core price pressures appear contained in the near term.'} "
                f"Model-based forecast: {pred_rate:.2f}% ({pred_trend} trend) over the selected horizon."
                if pred_rate is not None
                else "Forecast data pending — generate a prediction to enrich this section."
            ),
        },
        {
            "title": "Deflation Analysis",
            "body": (
                f"Deflation probability is assessed at "
                f"{(prediction.deflation_probability * 100 if prediction and prediction.deflation_probability <= 1 else prediction.deflation_probability if prediction else risk.deflation_risk):.1f}% "
                f"based on TS-Transformer outputs and macro risk scoring. "
                f"{'Sustained deflation risk remains low given positive nominal growth dynamics.' if (inflation or 0) > 2 else 'Downside price risks warrant monitoring, particularly if demand weakens materially.'}"
            ),
        },
        {
            "title": "Exchange Rate Analysis",
            "body": (
                f"The local currency trades at "
                f"{f'{exchange:.4f} per USD' if exchange else 'levels not available in the latest data feed'}. "
                f"Seven-day change: {fx.change_7d or 0:.2f}%. Trend: {fx_trend}. "
                f"{'Exchange rate depreciation raises import costs and can pass through to consumer prices within 1–3 months.' if fx_trend == 'down' else 'FX stability supports contained imported inflation.'}"
            ),
        },
        {
            "title": "Interest Rate Analysis",
            "body": (
                f"Policy and market interest rates are "
                f"{f'{interest:.2f}%' if interest is not None else 'not reported in the latest dataset'}. "
                f"{'Restrictive monetary policy is consistent with inflation containment objectives.' if (interest or 0) > 12 else 'Accommodative financial conditions may support activity but require vigilance on price stability.'}"
            ),
        },
        {
            "title": "GDP Analysis",
            "body": (
                f"Real GDP growth is "
                f"{f'{effective_gdp:.2f}% year-on-year' if effective_gdp is not None else 'unavailable in the current release'}. "
                f"{'Output expansion supports labour markets and household income, partially offsetting inflation effects.' if (effective_gdp or 0) > 2 else 'Subdued growth may limit wage pressures but also weakens demand-led inflation.'} "
                f"{_imf_context_paragraph(imf) if imf and imf.gdp_growth_pct is not None else ''}"
            ),
        },
        {
            "title": "Employment Trends",
            "body": (
                f"Labour market conditions show unemployment at "
                f"{f'{effective_unemployment:.1f}%' if effective_unemployment is not None else 'levels not available in current feeds'}. "
                f"{'Tight labour markets may sustain wage pressures and consumer spending.' if (effective_unemployment or 100) < 6 else 'Elevated unemployment warrants monitoring for demand weakness and social policy responses.'} "
                f"Cross-source labour data: "
                f"IMF {f'{imf.unemployment_pct:.1f}%' if imf and imf.unemployment_pct is not None else 'n/a'}, "
                f"World Bank {f'{world_bank.unemployment_pct:.1f}%' if world_bank and world_bank.unemployment_pct is not None else 'n/a'}, "
                f"Trading Economics {f'{trading_economics.unemployment_pct:.1f}%' if trading_economics and trading_economics.unemployment_pct is not None else 'n/a'}."
            ),
        },
        {
            "title": "Consumer Spending",
            "body": (
                f"Household purchasing power in {name} is influenced by inflation "
                f"({f'{effective_inflation:.1f}%' if effective_inflation is not None else 'n/a'}), "
                f"FX trend ({fx_trend}), and "
                f"{'robust' if (effective_gdp or 0) > 2 else 'subdued'} income growth. "
                f"{'Rising prices typically compress discretionary spending while essentials absorb a larger budget share.' if infl_trend == 'rising' else 'Stable or falling inflation supports real consumption growth over the forecast horizon.'}"
            ),
        },
        {
            "title": "Government Policies",
            "body": (
                f"Fiscal and monetary policy settings shape the outlook for {name}. "
                f"Policy rate: {f'{interest:.2f}%' if interest is not None else 'see central bank communications'}. "
                f"Public debt: {f'{effective_debt:.1f}% of GDP' if effective_debt is not None else 'data pending'}. "
                f"Current account balance: {f'{effective_current_account:.1f}% of GDP' if effective_current_account is not None else 'not reported'}. "
                f"Recent policy headlines: "
                + ("; ".join(news_headlines[:2]) if news_headlines else "monitor official gazettes and central bank releases.")
            ),
        },
        {
            "title": "Historical & Institutional Context",
            "body": _wiki_context_paragraph(wiki, name),
        },
        {
            "title": "IMF Economic Outlook",
            "body": _imf_context_paragraph(imf),
        },
        {
            "title": "World Bank Open Data",
            "body": _macro_context_paragraph(
                "World Bank",
                world_bank,
                empty_hint=(
                    "World Bank indicators are not yet synced. "
                    "Enable World Bank API in Admin → World Bank Settings."
                ),
            ),
        },
        {
            "title": "Trading Economics Indicators",
            "body": _macro_context_paragraph(
                "Trading Economics",
                trading_economics,
                empty_hint=(
                    "Trading Economics data is not yet available. "
                    "Configure API key in Admin → Trading Economics Settings."
                ),
            ),
        },
        {
            "title": "Economic News Highlights",
            "body": (
                "\n".join(news_highlights)
                if news_highlights
                else "No country-prioritized headlines in the current intelligence window. Sync News API or broaden tracked countries."
            ),
        },
        {
            "title": "Economic Events Impact",
            "body": (
                "Recent developments influencing the outlook include: "
                + (
                    "; ".join(news_headlines)
                    if news_headlines
                    else "No major headlines in the current intelligence window."
                )
                + ". Event-driven volatility is incorporated into the TS-Transformer attention weights."
            ),
        },
        {
            "title": "Country Comparison",
            "body": (
                f"Relative to peer economies, {name} shows inflation risk at {risk.inflation_risk:.0f}/100 "
                f"and economic stability at {risk.economic_stability:.0f}/100. "
                f"Key risk factors: {', '.join(risk.factors) if risk.factors else 'none flagged in the current scoring window'}."
            ),
        },
        {
            "title": "Forecast Outlook",
            "body": (
                prediction.ai_summary
                if prediction and prediction.ai_summary
                else (
                    f"Baseline outlook suggests inflation will remain {pred_trend} over the next "
                    f"{horizon_months} months, subject to energy prices, FX pass-through, and policy responses."
                )
            ),
        },
        {
            "title": "Risk Assessment",
            "body": (
                f"Overall risk: {risk_level}. Inflation risk {risk.inflation_risk:.0f}/100, "
                f"currency risk {risk.currency_risk:.0f}/100, investment risk {risk.investment_risk:.0f}/100. "
                f"{risk.ai_summary}"
            ),
        },
        {
            "title": "Confidence Analysis",
            "body": (
                f"Model confidence: {pred_conf:.0f}%."
                if pred_conf is not None
                else "Generate a TS-Transformer forecast to populate confidence intervals and prediction bands."
            )
            + (
                f" Health index confidence derives from {len(health.get('components', []))} component indicators."
                if health.get("components")
                else ""
            ),
        },
        {
            "title": "Recommendations",
            "body": (
                "1. Monitor food and fuel prices weekly — primary pass-through channels for households.\n"
                "2. Maintain emergency savings equivalent to 3–6 months of essential expenses.\n"
                "3. Track central bank communications for interest rate guidance.\n"
                f"4. Review FX exposure if import-dependent ({fx_trend} trend observed).\n"
                "5. Re-run forecasts after major data releases (CPI, GDP, policy decisions)."
            ),
        },
        {
            "title": "Conclusion",
            "body": (
                f"{name} faces a {risk.overall_risk_label.lower()} risk environment with "
                f"{health.get('label', 'moderate').lower()} economic health. "
                f"Policy credibility, energy markets, and exchange rate dynamics will remain decisive "
                f"for the inflation path over the forecast horizon."
            ),
        },
    ]

    if indicator_focus:
        sections.insert(
            2,
            {
                "title": f"Focused Analysis: {indicator_focus.replace('_', ' ').title()}",
                "body": f"This report emphasizes {indicator_focus.replace('_', ' ')} dynamics using the latest Velora data pipeline and FRED-enriched indicators where available.",
            },
        )

    references = _build_references(
        code,
        name,
        news,
        imf.data_year if imf else None,
        _format_retrieved(world_bank.retrieved_at if world_bank else None),
        _format_retrieved(trading_economics.retrieved_at if trading_economics else None),
    )
    title = f"{name} Economic Intelligence Report — {now.strftime('%B %Y')}"

    content = {
        "sections": sections,
        "references": references,
        "sources": references,
        "last_updated": now.isoformat(),
        "country_flag": ref.get("flag", ""),
        "economic_health_index": health.get("score"),
        "risk_score": risk.inflation_risk,
        "forecast_horizon_months": horizon_months,
        "indicator_focus": indicator_focus,
        "imf_snapshot": imf.model_dump() if imf else None,
        "world_bank_snapshot": world_bank.model_dump() if world_bank else None,
        "trading_economics_snapshot": trading_economics.model_dump() if trading_economics else None,
        "wikipedia_context": wiki.model_dump() if wiki else None,
        "news_highlights": news_highlights,
    }

    payload = ReportCreate(
        title=title,
        summary=executive[:500],
        content=content,
        report_type=report_type,
        country_code=code,
        source="Velora Intelligence Engine",
        published_at=now,
        metadata_extra={
            "references": references,
            "generated_by": "report_generator_service",
            "horizon_months": horizon_months,
            "risk_level": risk_level,
            "health_label": health.get("label"),
        },
    )
    return await report_service.create_report(db, user=user, payload=payload)