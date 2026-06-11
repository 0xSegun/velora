"""
Generate realistic sample data CSV files for Velora.

This script creates:
1. sample_nigeria_cpi.csv       — Monthly Nigerian CPI data 2000-2024
2. sample_economic_data.csv     — Monthly Nigerian economic indicators 2000-2024
3. sample_global_data.csv       — Quarterly data for 5 countries 2015-2024

All values are based on realistic historical trends for Nigeria and other
economies, with controlled noise to simulate real-world variation.
"""

import csv
import math
import os
import random
from datetime import date, timedelta

random.seed(42)

DATA_DIR = os.path.dirname(os.path.abspath(__file__))


# =====================================================================
#  Helpers
# =====================================================================
def _noise(scale: float = 1.0) -> float:
    return random.gauss(0, scale)


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _monthly_dates(start_year: int, start_month: int, end_year: int, end_month: int):
    """Yield (year, month) tuples."""
    y, m = start_year, start_month
    while (y, m) <= (end_year, end_month):
        yield y, m
        m += 1
        if m > 12:
            m = 1
            y += 1


def _quarterly_dates(start_year: int, end_year: int):
    """Yield (year, quarter_start_month) tuples."""
    for y in range(start_year, end_year + 1):
        for q_month in [1, 4, 7, 10]:
            yield y, q_month


# =====================================================================
#  1. Nigerian CPI Data (Monthly, 2000-2024)
# =====================================================================
def generate_nigeria_cpi() -> str:
    """Generate sample_nigeria_cpi.csv with realistic CPI and inflation values."""
    filepath = os.path.join(DATA_DIR, "sample_nigeria_cpi.csv")

    # Base CPI index (rebased to 100 in Jan 2000)
    cpi_index = 100.0

    # Inflation targets by period (approximate annual %)
    inflation_regimes = {
        (2000, 2002): (14.0, 3.0),   # High, volatile
        (2003, 2005): (14.0, 2.5),
        (2005, 2007): (10.0, 2.0),
        (2007, 2008): (12.0, 3.0),   # Global financial crisis
        (2009, 2010): (12.5, 2.0),
        (2011, 2013): (10.5, 1.5),
        (2014, 2014): (8.5, 1.0),
        (2015, 2015): (9.5, 1.5),
        (2016, 2016): (16.0, 2.0),   # Recession
        (2017, 2017): (16.5, 1.5),
        (2018, 2019): (11.5, 1.0),
        (2020, 2020): (14.0, 2.0),   # COVID
        (2021, 2021): (17.0, 1.5),
        (2022, 2022): (20.0, 2.0),   # Naira devaluation starts
        (2023, 2023): (25.0, 3.0),
        (2024, 2024): (30.0, 4.0),   # Severe devaluation
    }

    def _get_regime(year: int) -> tuple[float, float]:
        for (sy, ey), params in inflation_regimes.items():
            if sy <= year <= ey:
                return params
        return (12.0, 2.0)

    rows = []
    prev_cpi = cpi_index

    for y, m in _monthly_dates(2000, 1, 2024, 9):
        target_annual, noise_scale = _get_regime(y)
        # Monthly inflation factor
        monthly_rate = target_annual / 12.0 + _noise(noise_scale / 12.0)
        # Seasonal component (prices often rise in December/January)
        seasonal = 0.3 * math.sin(2 * math.pi * (m - 1) / 12)
        monthly_rate += seasonal / 12.0
        monthly_rate = max(monthly_rate, -0.5)  # prevent negative CPI moves

        cpi_index = prev_cpi * (1 + monthly_rate / 100.0)

        # Annualised YoY inflation (simplified: 12 × monthly)
        inflation_rate = _clamp(monthly_rate * 12, -2.0, 40.0)
        food_inflation = inflation_rate + _noise(1.5) + 2.0  # food tends higher
        food_inflation = _clamp(food_inflation, 0.0, 45.0)
        core_inflation = inflation_rate - _noise(1.0) - 1.5
        core_inflation = _clamp(core_inflation, 0.0, 35.0)

        rows.append({
            "date": f"{y}-{m:02d}-01",
            "cpi_index": round(cpi_index, 2),
            "inflation_rate": round(inflation_rate, 2),
            "food_inflation": round(food_inflation, 2),
            "core_inflation": round(core_inflation, 2),
            "country_code": "NG",
        })
        prev_cpi = cpi_index

    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"✓ Generated {filepath}  ({len(rows)} rows)")
    return filepath


# =====================================================================
#  2. Nigerian Economic Data (Monthly, 2000-2024)
# =====================================================================
def generate_economic_data() -> str:
    """Generate sample_economic_data.csv with all 8 model features."""
    filepath = os.path.join(DATA_DIR, "sample_economic_data.csv")

    rows = []

    # Initial values (roughly Jan 2000)
    cpi = 100.0
    gdp_growth = 5.3
    interest_rate = 14.0
    exchange_rate = 101.0  # NGN per USD
    oil_price = 28.0       # Brent USD/bbl
    gov_spending = 450.0   # billion NGN per month
    employment_rate = 94.0
    unemployment_rate = 6.0
    money_supply = 1200.0  # M2 billion NGN
    trade_balance = -10.0
    inflation_rate = 14.0

    for y, m in _monthly_dates(2000, 1, 2024, 9):
        # ── CPI ──
        regime_base = {
            range(2000, 2006): 12.0,
            range(2006, 2010): 10.0,
            range(2010, 2015): 9.5,
            range(2015, 2018): 15.0,
            range(2018, 2020): 11.5,
            range(2020, 2022): 16.0,
            range(2022, 2024): 24.0,
            range(2024, 2025): 30.0,
        }
        base_inf = 12.0
        for rng, val in regime_base.items():
            if y in rng:
                base_inf = val
                break

        monthly_inf = base_inf / 12.0 + _noise(0.3)
        cpi *= (1 + monthly_inf / 100.0)
        inflation_rate = _clamp(base_inf + _noise(1.5), 2.0, 38.0)

        # ── GDP Growth (quarterly interpolated) ──
        gdp_targets = {
            range(2000, 2004): 4.5,
            range(2004, 2008): 6.5,
            range(2008, 2010): 5.0,
            range(2010, 2015): 5.5,
            range(2015, 2017): -0.5,
            range(2017, 2020): 2.0,
            range(2020, 2021): -1.8,
            range(2021, 2023): 3.2,
            range(2023, 2025): 2.8,
        }
        gdp_base = 3.0
        for rng, val in gdp_targets.items():
            if y in rng:
                gdp_base = val
                break
        gdp_growth = _clamp(gdp_base + _noise(0.5), -4.0, 10.0)

        # ── Interest Rate (MPR) ──
        mpr_targets = {
            range(2000, 2006): 14.0,
            range(2006, 2010): 10.0,
            range(2010, 2015): 12.0,
            range(2015, 2017): 14.0,
            range(2017, 2020): 13.5,
            range(2020, 2022): 11.5,
            range(2022, 2024): 18.0,
            range(2024, 2025): 26.0,
        }
        mpr_base = 13.0
        for rng, val in mpr_targets.items():
            if y in rng:
                mpr_base = val
                break
        interest_rate = _clamp(mpr_base + _noise(0.5), 6.0, 30.0)

        # ── Exchange Rate (NGN/USD) ──
        fx_targets = {
            range(2000, 2004): 120.0,
            range(2004, 2008): 130.0,
            range(2008, 2012): 150.0,
            range(2012, 2015): 160.0,
            range(2015, 2017): 310.0,
            range(2017, 2020): 360.0,
            range(2020, 2022): 415.0,
            range(2022, 2023): 460.0,
            range(2023, 2024): 900.0,
            range(2024, 2025): 1500.0,
        }
        fx_base = 150.0
        for rng, val in fx_targets.items():
            if y in rng:
                fx_base = val
                break
        # Smooth transition
        exchange_rate += (fx_base - exchange_rate) * 0.08 + _noise(fx_base * 0.01)
        exchange_rate = max(exchange_rate, 90.0)

        # ── Oil Price (Brent Crude) ──
        oil_targets = {
            range(2000, 2004): 30.0,
            range(2004, 2006): 55.0,
            range(2006, 2008): 90.0,
            range(2008, 2009): 55.0,
            range(2009, 2012): 95.0,
            range(2012, 2015): 100.0,
            range(2015, 2017): 45.0,
            range(2017, 2020): 65.0,
            range(2020, 2021): 42.0,
            range(2021, 2022): 75.0,
            range(2022, 2023): 95.0,
            range(2023, 2025): 80.0,
        }
        oil_base = 60.0
        for rng, val in oil_targets.items():
            if y in rng:
                oil_base = val
                break
        oil_price += (oil_base - oil_price) * 0.1 + _noise(3.0)
        oil_price = max(oil_price, 15.0)

        # ── Government Spending ──
        gov_base = 450.0 * (1.12 ** ((y - 2000) + m / 12.0))  # ~12% annual growth
        gov_spending = gov_base + _noise(gov_base * 0.05)
        gov_spending = max(gov_spending, 300.0)

        # ── Employment / Unemployment ──
        unemp_targets = {
            range(2000, 2006): 6.5,
            range(2006, 2010): 5.5,
            range(2010, 2015): 7.5,
            range(2015, 2017): 14.0,
            range(2017, 2020): 23.0,
            range(2020, 2022): 33.0,
            range(2022, 2024): 28.0,
            range(2024, 2025): 25.0,
        }
        unemp_base = 10.0
        for rng, val in unemp_targets.items():
            if y in rng:
                unemp_base = val
                break
        unemployment_rate += (unemp_base - unemployment_rate) * 0.05 + _noise(0.3)
        unemployment_rate = _clamp(unemployment_rate, 2.0, 40.0)
        employment_rate = 100.0 - unemployment_rate

        # ── Money Supply M2 ──
        m2_growth = 15.0 + _noise(2.0)  # ~15% annual M2 growth
        money_supply *= (1 + m2_growth / 1200.0)
        money_supply = max(money_supply, 800.0)

        # ── Trade Balance ──
        trade_base = (oil_price - 60.0) * 2.0 - 20.0  # oil-dependent
        trade_balance = trade_base + _noise(15.0)

        rows.append({
            "date": f"{y}-{m:02d}-01",
            "country_code": "NG",
            "cpi": round(cpi, 2),
            "gdp_growth": round(gdp_growth, 2),
            "interest_rate": round(interest_rate, 2),
            "exchange_rate_usd": round(exchange_rate, 2),
            "oil_price_brent": round(oil_price, 2),
            "gov_spending_bn_ngn": round(gov_spending, 2),
            "employment_rate": round(employment_rate, 2),
            "unemployment_rate": round(unemployment_rate, 2),
            "money_supply_m2_bn_ngn": round(money_supply, 2),
            "trade_balance_bn_ngn": round(trade_balance, 2),
            "inflation_rate": round(inflation_rate, 2),
        })

    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"✓ Generated {filepath}  ({len(rows)} rows)")
    return filepath


# =====================================================================
#  3. Global Data (Quarterly, 5 countries, 2015-2024)
# =====================================================================
def generate_global_data() -> str:
    """Generate sample_global_data.csv for NG, US, GB, GH, ZA."""
    filepath = os.path.join(DATA_DIR, "sample_global_data.csv")

    countries = {
        "NG": {
            "name": "Nigeria",
            "cpi_base": 250.0,
            "gdp": 2.5, "int_rate": 13.5, "fx": 200.0,
            "inf": 12.0, "cpi_growth": 0.03,
        },
        "US": {
            "name": "United States",
            "cpi_base": 237.0,
            "gdp": 2.3, "int_rate": 1.5, "fx": 1.0,
            "inf": 2.0, "cpi_growth": 0.005,
        },
        "GB": {
            "name": "United Kingdom",
            "cpi_base": 105.0,
            "gdp": 1.8, "int_rate": 0.5, "fx": 0.65,
            "inf": 2.0, "cpi_growth": 0.005,
        },
        "GH": {
            "name": "Ghana",
            "cpi_base": 180.0,
            "gdp": 4.0, "int_rate": 25.0, "fx": 3.8,
            "inf": 15.0, "cpi_growth": 0.025,
        },
        "ZA": {
            "name": "South Africa",
            "cpi_base": 110.0,
            "gdp": 1.2, "int_rate": 6.5, "fx": 14.0,
            "inf": 5.0, "cpi_growth": 0.012,
        },
    }

    # Yearly overrides for realism
    yearly_overrides = {
        "NG": {
            2016: {"inf": 16.0, "gdp": -1.5, "fx": 310.0, "int_rate": 14.0},
            2017: {"inf": 16.5, "gdp": 0.8, "fx": 360.0},
            2020: {"inf": 14.0, "gdp": -1.8},
            2021: {"inf": 17.0, "gdp": 3.6},
            2022: {"inf": 21.0, "fx": 440.0, "int_rate": 16.5},
            2023: {"inf": 28.0, "fx": 900.0, "int_rate": 18.75},
            2024: {"inf": 33.0, "fx": 1500.0, "int_rate": 26.25},
        },
        "US": {
            2020: {"inf": 1.2, "gdp": -3.5, "int_rate": 0.25},
            2021: {"inf": 4.7, "gdp": 5.9, "int_rate": 0.25},
            2022: {"inf": 8.0, "gdp": 2.1, "int_rate": 4.25},
            2023: {"inf": 4.1, "gdp": 2.5, "int_rate": 5.25},
            2024: {"inf": 3.2, "gdp": 2.8, "int_rate": 5.25},
        },
        "GB": {
            2020: {"inf": 0.9, "gdp": -9.3, "int_rate": 0.1},
            2021: {"inf": 2.6, "gdp": 7.6, "int_rate": 0.25},
            2022: {"inf": 9.1, "gdp": 4.1, "int_rate": 3.5},
            2023: {"inf": 7.3, "gdp": 0.1, "int_rate": 5.25},
            2024: {"inf": 3.9, "gdp": 0.8, "int_rate": 5.0},
        },
        "GH": {
            2020: {"inf": 10.4, "gdp": 0.4},
            2022: {"inf": 31.7, "gdp": 3.1, "int_rate": 27.0, "fx": 10.0},
            2023: {"inf": 42.0, "gdp": 2.3, "int_rate": 30.0, "fx": 12.5},
            2024: {"inf": 23.0, "gdp": 4.0, "int_rate": 29.0, "fx": 15.0},
        },
        "ZA": {
            2020: {"inf": 3.3, "gdp": -6.3, "fx": 17.0},
            2022: {"inf": 6.9, "gdp": 2.0, "int_rate": 7.0},
            2023: {"inf": 6.0, "gdp": 0.6, "int_rate": 8.25},
            2024: {"inf": 5.4, "gdp": 1.0, "int_rate": 8.0},
        },
    }

    rows = []
    for cc, params in countries.items():
        cpi = params["cpi_base"]
        fx = params["fx"]
        for y, qm in _quarterly_dates(2015, 2024):
            if y == 2024 and qm > 7:
                continue  # up to Q3 2024

            overrides = yearly_overrides.get(cc, {}).get(y, {})
            inf = overrides.get("inf", params["inf"]) + _noise(0.5)
            gdp = overrides.get("gdp", params["gdp"]) + _noise(0.3)
            ir = overrides.get("int_rate", params["int_rate"]) + _noise(0.2)
            fx_target = overrides.get("fx", fx)

            # Smooth FX
            fx += (fx_target - fx) * 0.2 + _noise(fx * 0.01)
            fx = max(fx, 0.5)

            # CPI evolves
            cpi *= (1 + inf / 400.0)

            rows.append({
                "date": f"{y}-{qm:02d}-01",
                "country_code": cc,
                "country_name": params["name"],
                "cpi": round(cpi, 2),
                "gdp_growth": round(gdp, 2),
                "interest_rate": round(ir, 2),
                "exchange_rate_usd": round(fx, 4),
                "inflation_rate": round(inf, 2),
            })

    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"✓ Generated {filepath}  ({len(rows)} rows)")
    return filepath


# =====================================================================
#  Main
# =====================================================================
if __name__ == "__main__":
    generate_nigeria_cpi()
    generate_economic_data()
    generate_global_data()
    print("\n✅ All sample data generated successfully.")
