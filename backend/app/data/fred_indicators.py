"""
FRED economic indicator catalog — used for seeding and admin UI.
"""

from __future__ import annotations

from typing import TypedDict


class FredIndicatorDef(TypedDict):
    code: str
    name: str
    category: str
    description: str
    frequency: str
    field: str


FRED_INDICATOR_CATALOG: list[FredIndicatorDef] = [
    # Inflation
    {
        "code": "CPIAUCSL",
        "name": "Consumer Price Index",
        "category": "inflation",
        "description": "All-items CPI for all urban consumers (seasonally adjusted).",
        "frequency": "Monthly",
        "field": "cpi",
    },
    {
        "code": "CPILFESL",
        "name": "Core CPI",
        "category": "inflation",
        "description": "CPI excluding food and energy (less volatile inflation measure).",
        "frequency": "Monthly",
        "field": "core_inflation",
    },
    {
        "code": "PPIACO",
        "name": "Producer Price Index",
        "category": "inflation",
        "description": "PPI for all commodities — upstream price pressures.",
        "frequency": "Monthly",
        "field": "producer_price_index",
    },
    # Interest rates
    {
        "code": "FEDFUNDS",
        "name": "Federal Funds Rate",
        "category": "interest_rate",
        "description": "Effective federal funds rate — key US monetary policy rate.",
        "frequency": "Monthly",
        "field": "interest_rate",
    },
    {
        "code": "GS10",
        "name": "10-Year Treasury Rate",
        "category": "interest_rate",
        "description": "Market yield on 10-year US Treasury securities.",
        "frequency": "Daily",
        "field": "treasury_10y",
    },
    # Employment
    {
        "code": "UNRATE",
        "name": "Unemployment Rate",
        "category": "employment",
        "description": "Civilian unemployment rate (seasonally adjusted).",
        "frequency": "Monthly",
        "field": "unemployment_rate",
    },
    {
        "code": "PAYEMS",
        "name": "Nonfarm Payrolls",
        "category": "employment",
        "description": "Total nonfarm payroll employment — labor market strength.",
        "frequency": "Monthly",
        "field": "nonfarm_payrolls",
    },
    # Economic activity
    {
        "code": "GDP",
        "name": "Gross Domestic Product",
        "category": "economic_activity",
        "description": "Nominal GDP — broad measure of economic output.",
        "frequency": "Quarterly",
        "field": "gdp",
    },
    {
        "code": "GDPC1",
        "name": "Real GDP",
        "category": "economic_activity",
        "description": "Real GDP chained 2017 dollars — inflation-adjusted output.",
        "frequency": "Quarterly",
        "field": "real_gdp",
    },
    {
        "code": "INDPRO",
        "name": "Industrial Production Index",
        "category": "economic_activity",
        "description": "Industrial production index — manufacturing and utilities output.",
        "frequency": "Monthly",
        "field": "industrial_production",
    },
    {
        "code": "RSAFS",
        "name": "Retail Sales",
        "category": "economic_activity",
        "description": "Advance retail sales — consumer spending indicator.",
        "frequency": "Monthly",
        "field": "retail_sales",
    },
    # Money supply
    {
        "code": "M1SL",
        "name": "M1 Money Stock",
        "category": "money_supply",
        "description": "M1 money supply — currency and demand deposits.",
        "frequency": "Monthly",
        "field": "m1_money_stock",
    },
    {
        "code": "M2SL",
        "name": "M2 Money Stock",
        "category": "money_supply",
        "description": "M2 money supply — broader liquidity measure.",
        "frequency": "Monthly",
        "field": "money_supply",
    },
    # Exchange rate
    {
        "code": "DTWEXBGS",
        "name": "Trade Weighted Dollar Index",
        "category": "exchange_rate",
        "description": "Trade-weighted US dollar index (broad goods and services).",
        "frequency": "Daily",
        "field": "dollar_index",
    },
    # Commodities
    {
        "code": "DCOILWTICO",
        "name": "Crude Oil Prices (WTI)",
        "category": "commodity",
        "description": "West Texas Intermediate crude oil spot price.",
        "frequency": "Daily",
        "field": "oil_price",
    },
    {
        "code": "GOLDAMGBD228NLBM",
        "name": "Gold Prices",
        "category": "commodity",
        "description": "London gold fixing price in USD per troy ounce.",
        "frequency": "Daily",
        "field": "gold_price",
    },
    # Housing
    {
        "code": "HOUST",
        "name": "Housing Starts",
        "category": "housing",
        "description": "New privately-owned housing units started.",
        "frequency": "Monthly",
        "field": "housing_starts",
    },
    {
        "code": "CSUSHPINSA",
        "name": "Home Price Index",
        "category": "housing",
        "description": "S&P/Case-Shiller US national home price index.",
        "frequency": "Monthly",
        "field": "housing_price_index",
    },
    # Consumer confidence
    {
        "code": "UMCSENT",
        "name": "Consumer Sentiment Index",
        "category": "consumer_confidence",
        "description": "University of Michigan consumer sentiment index.",
        "frequency": "Monthly",
        "field": "consumer_confidence_index",
    },
]

DEFAULT_FEATURE_CONFIG: dict = {
    "include_lag_variables": True,
    "include_rolling_means": True,
    "include_moving_averages": True,
    "include_percentage_changes": True,
    "include_growth_rates": True,
    "input_sequence_length": 24,
    "forecast_horizon": 6,
    "normalization_method": "minmax",
}

DEFAULT_ENABLED_CODES = {
    "CPIAUCSL",
    "CPILFESL",
    "FEDFUNDS",
    "UNRATE",
    "GDP",
    "GDPC1",
    "INDPRO",
    "M2SL",
    "DCOILWTICO",
    "PPIACO",
}