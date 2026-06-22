"""
Database seeding — default admin account, countries, and economic indicators.
"""

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.country import Country
from app.models.economic_data import DataSource, EconomicData
from app.models.intelligence import EconomicEvent, EconomicNews, ResearchPublication, SentimentRecord
from app.models.user import User, UserRole
from app.services.country_service import COUNTRY_REFERENCE
from app.utils.security import hash_password

logger = logging.getLogger(__name__)
settings = get_settings()

# name, code, inflation, deflation_risk, gdp (bn USD), interest_rate
DEFAULT_COUNTRIES = [
    ("Nigeria", "NG", 28.9, 0.12, 477.4, 27.5),
    ("United States", "US", 3.2, 0.08, 28600.0, 5.25),
    ("United Kingdom", "GB", 3.4, 0.10, 3100.0, 5.25),
    ("Germany", "DE", 2.8, 0.09, 4300.0, 4.5),
    ("France", "FR", 2.5, 0.09, 3100.0, 4.0),
    ("Japan", "JP", 2.5, 0.15, 4200.0, 0.1),
    ("India", "IN", 5.1, 0.11, 3700.0, 6.5),
    ("China", "CN", 0.5, 0.18, 17800.0, 3.45),
    ("Brazil", "BR", 4.6, 0.13, 2100.0, 10.75),
    ("South Africa", "ZA", 5.3, 0.14, 400.0, 8.25),
    ("Ghana", "GH", 23.0, 0.13, 76.0, 29.0),
    ("Kenya", "KE", 6.8, 0.10, 115.0, 13.0),
    ("Canada", "CA", 2.8, 0.08, 2200.0, 5.0),
    ("Australia", "AU", 3.6, 0.09, 1700.0, 4.35),
]

# Extended indicator profiles for economic_data seeding
ECONOMIC_PROFILES: dict[str, dict] = {
    "NG": {
        "cpi": 285.0,
        "gdp_growth": 3.2,

        "oil_price": 82.0,
        "gov_spending": 18.5,
        "employment_rate": 94.8,
        "unemployment_rate": 5.2,
        "money_supply": 65000.0,
        "trade_balance": -15.0,
    },
    "US": {
        "cpi": 315.0,
        "gdp_growth": 2.8,

        "oil_price": 78.0,
        "gov_spending": 6800.0,
        "employment_rate": 95.8,
        "unemployment_rate": 4.2,
        "money_supply": 21000.0,
        "trade_balance": -780.0,
    },
    "GB": {
        "cpi": 132.0,
        "gdp_growth": 0.8,

        "oil_price": 78.0,
        "gov_spending": 1200.0,
        "employment_rate": 96.0,
        "unemployment_rate": 4.0,
        "money_supply": 3200.0,
        "trade_balance": -45.0,
    },
    "DE": {
        "cpi": 118.0,
        "gdp_growth": 0.5,

        "oil_price": 78.0,
        "gov_spending": 1650.0,
        "employment_rate": 96.5,
        "unemployment_rate": 3.5,
        "money_supply": 3800.0,
        "trade_balance": 220.0,
    },
    "FR": {
        "cpi": 115.0,
        "gdp_growth": 1.1,

        "oil_price": 78.0,
        "gov_spending": 1350.0,
        "employment_rate": 95.2,
        "unemployment_rate": 4.8,
        "money_supply": 2900.0,
        "trade_balance": -35.0,
    },
    "JP": {
        "cpi": 108.0,
        "gdp_growth": 1.2,

        "oil_price": 78.0,
        "gov_spending": 1100.0,
        "employment_rate": 97.0,
        "unemployment_rate": 2.6,
        "money_supply": 1250.0,
        "trade_balance": 5.0,
    },
    "IN": {
        "cpi": 195.0,
        "gdp_growth": 6.8,

        "oil_price": 78.0,
        "gov_spending": 420.0,
        "employment_rate": 93.5,
        "unemployment_rate": 6.5,
        "money_supply": 42000.0,
        "trade_balance": -85.0,
    },
    "CN": {
        "cpi": 102.5,
        "gdp_growth": 5.0,

        "oil_price": 78.0,
        "gov_spending": 3800.0,
        "employment_rate": 95.0,
        "unemployment_rate": 5.0,
        "money_supply": 280000.0,
        "trade_balance": 420.0,
    },
    "BR": {
        "cpi": 165.0,
        "gdp_growth": 2.5,

        "oil_price": 78.0,
        "gov_spending": 310.0,
        "employment_rate": 92.0,
        "unemployment_rate": 7.8,
        "money_supply": 5200.0,
        "trade_balance": 55.0,
    },
    "ZA": {
        "cpi": 128.0,
        "gdp_growth": 1.0,

        "oil_price": 78.0,
        "gov_spending": 95.0,
        "employment_rate": 91.0,
        "unemployment_rate": 32.0,
        "money_supply": 4200.0,
        "trade_balance": 8.0,
    },
    "GH": {
        "cpi": 210.0,
        "gdp_growth": 4.0,

        "oil_price": 78.0,
        "gov_spending": 18.0,
        "employment_rate": 90.5,
        "unemployment_rate": 4.5,
        "money_supply": 180.0,
        "trade_balance": -2.5,
    },
    "KE": {
        "cpi": 145.0,
        "gdp_growth": 5.2,

        "oil_price": 78.0,
        "gov_spending": 22.0,
        "employment_rate": 92.5,
        "unemployment_rate": 5.5,
        "money_supply": 420.0,
        "trade_balance": -6.0,
    },
    "CA": {
        "cpi": 158.0,
        "gdp_growth": 1.8,

        "oil_price": 78.0,
        "gov_spending": 480.0,
        "employment_rate": 95.5,
        "unemployment_rate": 6.0,
        "money_supply": 2100.0,
        "trade_balance": -12.0,
    },
    "AU": {
        "cpi": 138.0,
        "gdp_growth": 2.1,

        "oil_price": 78.0,
        "gov_spending": 520.0,
        "employment_rate": 96.2,
        "unemployment_rate": 4.0,
        "money_supply": 1800.0,
        "trade_balance": 25.0,
    },
}


async def seed_admin_user(db: AsyncSession) -> User | None:
    """Create default admin if no admin exists."""
    result = await db.execute(
        select(User).where(User.role == UserRole.ADMIN).limit(1)
    )
    if result.scalar_one_or_none():
        return None

    existing = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
    if existing.scalar_one_or_none():
        return None

    admin = User(
        email=settings.ADMIN_EMAIL,
        password_hash=hash_password(settings.ADMIN_PASSWORD),
        first_name=settings.ADMIN_FIRST_NAME,
        last_name=settings.ADMIN_LAST_NAME,
        full_name=f"{settings.ADMIN_FIRST_NAME} {settings.ADMIN_LAST_NAME}".strip(),
        role=UserRole.ADMIN,
        is_verified=True,
        is_active=True,
        country="NG",
    )
    db.add(admin)
    await db.flush()
    logger.info("Seeded default admin account: %s", settings.ADMIN_EMAIL)
    return admin


async def seed_default_countries(db: AsyncSession) -> int:
    """Seed country reference rows, adding any missing defaults."""
    result = await db.execute(select(Country))
    existing = {row.code: row for row in result.scalars().all()}
    created = 0

    for name, code, inflation, deflation_risk, gdp, interest in DEFAULT_COUNTRIES:
        ref = COUNTRY_REFERENCE.get(code, {})
        if code in existing:
            row = existing[code]
            if not row.region:
                row.region = ref.get("region")
            if not row.continent:
                row.continent = ref.get("continent")
            if not row.currency:
                row.currency = ref.get("currency")
            continue
        db.add(
            Country(
                name=name,
                code=code,
                region=ref.get("region"),
                continent=ref.get("continent"),
                currency=ref.get("currency"),
                inflation_rate=inflation,
                deflation_risk=deflation_risk,
                gdp=gdp,
                interest_rate=interest,
                economic_stability_score=round(100 - deflation_risk * 100 - inflation, 1),
                currency_strength=50.0,
            )
        )
        created += 1

    if created:
        await db.flush()
        logger.info("Seeded %d default countries", created)
    else:
        await db.flush()
    return created


async def seed_economic_data(db: AsyncSession, months: int = 12) -> int:
    """Seed monthly economic indicator history when economic_data is empty."""
    count_result = await db.execute(select(func.count()).select_from(EconomicData))
    if (count_result.scalar() or 0) > 0:
        return 0

    created = 0
    today = date.today().replace(day=1)

    for name, code, inflation, _deflation, gdp, interest in DEFAULT_COUNTRIES:
        profile = ECONOMIC_PROFILES.get(code, {})
        for month_offset in range(months - 1, -1, -1):
            record_date = today - timedelta(days=month_offset * 30)
            record_date = record_date.replace(day=1)
            drift = (months - 1 - month_offset) * 0.05
            inflation_val = max(0.1, inflation - drift + (month_offset % 3) * 0.1)

            db.add(
                EconomicData(
                    country_code=code,
                    country_name=name,
                    cpi=profile.get("cpi", 100.0) * (1 - month_offset * 0.003),
                    gdp=gdp,
                    gdp_growth=profile.get("gdp_growth", 2.0) - drift * 0.1,
                    interest_rate=interest,
                    exchange_rate=None,
                    oil_price=profile.get("oil_price", 75.0),
                    gov_spending=profile.get("gov_spending"),
                    employment_rate=profile.get("employment_rate"),
                    unemployment_rate=profile.get("unemployment_rate"),
                    inflation_rate=round(inflation_val, 2),
                    money_supply=profile.get("money_supply"),
                    trade_balance=profile.get("trade_balance"),
                    data_date=record_date,
                    source=DataSource.MANUAL,
                )
            )
            created += 1

    await db.flush()
    logger.info("Seeded %d economic indicator records", created)
    return created


async def sync_countries_to_economic_data(db: AsyncSession) -> int:
    """Ensure each country has a latest economic_data snapshot."""
    result = await db.execute(select(Country).order_by(Country.name))
    countries = result.scalars().all()
    created = 0
    today = date.today().replace(day=1)

    for country in countries:
        existing = await db.execute(
            select(EconomicData)
            .where(EconomicData.country_code == country.code)
            .order_by(EconomicData.data_date.desc())
            .limit(1)
        )
        if existing.scalar_one_or_none():
            continue

        profile = ECONOMIC_PROFILES.get(country.code, {})
        db.add(
            EconomicData(
                country_code=country.code,
                country_name=country.name,
                cpi=profile.get("cpi"),
                gdp=country.gdp,
                gdp_growth=profile.get("gdp_growth"),
                interest_rate=country.interest_rate,
                exchange_rate=None,
                oil_price=profile.get("oil_price", 75.0),
                gov_spending=profile.get("gov_spending"),
                employment_rate=profile.get("employment_rate"),
                unemployment_rate=profile.get("unemployment_rate"),
                inflation_rate=country.inflation_rate,
                money_supply=profile.get("money_supply"),
                trade_balance=profile.get("trade_balance"),
                data_date=today,
                source=DataSource.MANUAL,
            )
        )
        created += 1

    if created:
        await db.flush()
        logger.info("Synced %d country snapshots into economic_data", created)
    return created


ADVANCED_INDICATOR_DEFAULTS: dict[str, dict] = {
    "NG": {"core_inflation": 22.5, "producer_price_index": 145.0, "consumer_confidence_index": 62.0,
           "purchasing_managers_index": 48.5, "public_debt_ratio": 38.0, "commodity_price_index": 128.0,
           "housing_price_index": 115.0, "retail_sales": 3.2, "foreign_reserves": 33.0, "fiscal_deficit": -5.2},
    "US": {"core_inflation": 3.8, "producer_price_index": 142.0, "consumer_confidence_index": 102.0,
           "purchasing_managers_index": 52.0, "public_debt_ratio": 123.0, "commodity_price_index": 118.0,
           "housing_price_index": 310.0, "retail_sales": 2.5, "foreign_reserves": 800.0, "fiscal_deficit": -6.3},
    "GB": {"core_inflation": 4.2, "producer_price_index": 138.0, "consumer_confidence_index": 95.0,
           "purchasing_managers_index": 49.0, "public_debt_ratio": 101.0, "commodity_price_index": 115.0,
           "housing_price_index": 185.0, "retail_sales": 1.8, "foreign_reserves": 180.0, "fiscal_deficit": -4.5},
}

DEFAULT_EVENTS = [
    ("CBN Raises MPR by 400bps", "NG", "interest_rate_decision", 8.5, 7.5,
     "Central Bank of Nigeria increased monetary policy rate to combat inflation."),
    ("Fuel Subsidy Removal", "NG", "fuel_subsidy", 9.0, 8.5,
     "Federal government removed fuel subsidy, raising transport and food costs."),
    ("Fed Holds Rates Steady", "US", "monetary_policy", 5.0, 6.0,
     "Federal Reserve maintained benchmark rate amid cooling inflation."),
    ("UK Budget Release 2026", "GB", "budget_release", 6.0, 7.0,
     "HM Treasury published fiscal budget with revised spending allocations."),
    ("Oil Price Surge", "NG", "oil_price_shock", 7.5, 8.0,
     "Brent crude exceeded $90/barrel impacting import-dependent economies."),
    ("Naira Devaluation", "NG", "exchange_rate_policy", 8.0, 9.0,
     "Official exchange rate adjusted in managed float regime."),
    ("Global Supply Chain Disruption", "US", "commodity_shock", 6.5, 7.0,
     "Commodity price index rose on geopolitical supply constraints."),
]

DEFAULT_NEWS = [
    ("Nigeria Inflation Eases Slightly in Latest CPI Report", "NG", "inflation", "Reuters",
     "Headline inflation moderated marginally but food prices remain elevated. The National Bureau of Statistics reported softer core inflation while transport costs stayed firm.",
     0.25, 0.45, 0.30),
    ("US CPI Shows Continued Disinflation Trend", "US", "inflation", "Bloomberg",
     "Consumer prices rose 0.2% month-over-month, below consensus estimates. Services inflation cooled while shelter costs remained sticky.",
     0.55, 0.30, 0.15),
    ("Bank of England Signals Cautious Rate Path", "GB", "interest_rates", "Financial Times",
     "BoE minutes indicate a data-dependent approach to further rate adjustments amid mixed growth signals.",
     0.30, 0.50, 0.20),
    ("Emerging Market Currencies Under Pressure", None, "exchange_rates", "CNBC",
     "Dollar strength weighs on emerging-market currencies amid global risk-off sentiment and higher Treasury yields.",
     0.15, 0.40, 0.45),
    ("World Bank Warns on Food Price Volatility in Africa", "NG", "inflation", "World Bank",
     "The World Bank highlights climate and logistics shocks as key drivers of food price volatility across Sub-Saharan Africa.",
     0.20, 0.35, 0.45),
    ("IMF Revises Global Growth Outlook Amid Trade Tensions", None, "gdp", "IMF",
     "The IMF trimmed its global growth forecast while noting resilient US consumption and softer manufacturing PMIs in Europe.",
     0.40, 0.45, 0.15),
    ("OECD Inflation Monitor Shows Diverging Paths", "DE", "inflation", "OECD",
     "Euro-area disinflation continues but services prices prove persistent in several member economies.",
     0.45, 0.40, 0.15),
    ("Oil Prices Climb on Supply Concerns", "NG", "commodities", "Reuters",
     "Crude oil benchmarks rose on supply disruption fears, raising pass-through risks for fuel and transportation costs.",
     0.15, 0.30, 0.55),
    ("Naira Weakens at Official Market Window", "NG", "exchange_rates", "Bloomberg",
     "Naira depreciation at the official window increases import-cost pressures for manufacturers and households.",
     0.10, 0.35, 0.55),
    ("Trading Economics: Central Banks Hold Rates Steady", "GH", "interest_rates", "Trading Economics",
     "Several African central banks kept policy rates unchanged, citing the need to anchor inflation expectations.",
     0.35, 0.50, 0.15),
]

DEFAULT_PUBLICATIONS = [
    ("TS-Transformer Architecture for Macroeconomic Forecasting",
     "ts-transformer", "Velora Research Team",
     "This paper presents the Time-Series Transformer with multi-head attention for inflation prediction."),
    ("Inflation Dynamics in Sub-Saharan Africa: A Comparative Study",
     "inflation", "A. Okafor, M. Chen",
     "Comparative analysis of inflation drivers across 12 African economies using transformer models."),
    ("Deflation Risk Assessment Framework",
     "deflation", "Velora Research Team",
     "A systematic framework for quantifying deflation probability using attention-based models."),
    ("Attention Mechanisms in Economic Time Series",
     "architecture", "J. Williams, S. Adeyemi",
     "Technical documentation of attention weight interpretation for policy makers."),
]


async def seed_intelligence_data(db: AsyncSession) -> int:
    """Seed economic events, news, research publications, and sentiment."""
    created = 0
    now = datetime.now(timezone.utc)

    event_count = (await db.execute(select(func.count()).select_from(EconomicEvent))).scalar() or 0
    if event_count == 0:
        for title, country, cat, severity, impact, desc in DEFAULT_EVENTS:
            db.add(EconomicEvent(
                title=title, country=country, category=cat,
                event_date=date.today() - timedelta(days=created * 45 + 30),
                severity_score=severity, economic_impact_score=impact, description=desc,
            ))
            created += 1

    news_count = (await db.execute(select(func.count()).select_from(EconomicNews))).scalar() or 0
    if news_count == 0:
        for title, code, cat, source, summary, pos, neu, neg in DEFAULT_NEWS:
            db.add(EconomicNews(
                title=title, country_code=code, category=cat, summary=summary,
                content=summary,
                source=source, sentiment_positive=pos,
                sentiment_neutral=neu, sentiment_negative=neg,
                published_at=now - timedelta(days=created),
            ))
            created += 1

    pub_count = (await db.execute(select(func.count()).select_from(ResearchPublication))).scalar() or 0
    if pub_count == 0:
        for title, cat, authors, abstract in DEFAULT_PUBLICATIONS:
            db.add(ResearchPublication(
                title=title, category=cat, authors=authors, abstract=abstract,
                citation=f"{authors} (2026). {title}. Velora Research.",
                tags=[cat, "TS-Transformer", "inflation"],
                published_at=now - timedelta(days=created * 60),
            ))
            created += 1

    for code in ("NG", "US", "GB"):
        sent_count = await db.execute(
            select(func.count()).select_from(SentimentRecord).where(SentimentRecord.country_code == code)
        )
        if (sent_count.scalar() or 0) == 0:
            db.add(SentimentRecord(
                country_code=code, source_type="aggregated",
                positive_score=0.35, neutral_score=0.40, negative_score=0.25,
                summary=f"Baseline economic sentiment for {code}",
                recorded_at=now,
            ))
            created += 1

    # Enrich latest economic_data with advanced indicators
    for code, indicators in ADVANCED_INDICATOR_DEFAULTS.items():
        result = await db.execute(
            select(EconomicData)
            .where(EconomicData.country_code == code)
            .order_by(EconomicData.data_date.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row and row.core_inflation is None:
            for k, v in indicators.items():
                setattr(row, k, v)
            created += 1

    if created:
        await db.flush()
        logger.info("Seeded %d intelligence records", created)
    return created