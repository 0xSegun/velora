/**
 * Plain-language translations for ordinary users — avoids technical jargon.
 */

export type HealthLevel = "excellent" | "good" | "moderate" | "weak";

export interface SimpleForecast {
  currentSituation: string;
  expectedTrend: string;
  riskLevel: "Low" | "Moderate" | "High";
  confidenceLabel: string;
  bestCase: string;
  normalCase: string;
  worstCase: string;
  aiSummary: string;
}

export function economicHealthLevel(
  inflationRate?: number | null,
  riskLevel?: string | null,
): HealthLevel {
  const risk = (riskLevel ?? "").toLowerCase();
  if (risk === "critical" || risk === "high") return "weak";
  if (inflationRate != null) {
    if (inflationRate <= 4) return "excellent";
    if (inflationRate <= 8) return "good";
    if (inflationRate <= 15) return "moderate";
    return "weak";
  }
  if (risk === "medium") return "moderate";
  if (risk === "low") return "good";
  return "moderate";
}

export const HEALTH_LABELS: Record<
  HealthLevel,
  { label: string; color: string; description: string }
> = {
  excellent: {
    label: "Excellent",
    color: "#22c55e",
    description: "The economy looks stable. Price changes are manageable.",
  },
  good: {
    label: "Good",
    color: "#eab308",
    description: "Conditions are generally favourable with some price pressure.",
  },
  moderate: {
    label: "Moderate",
    color: "#f97316",
    description: "Prices are rising noticeably. Plan ahead for everyday costs.",
  },
  weak: {
    label: "Weak",
    color: "#ef4444",
    description: "Economic pressure is high. Consider adjusting your budget.",
  },
};

export function toSimpleForecast(params: {
  countryName: string;
  inflationRate?: number | null;
  trend?: string | null;
  riskLevel?: string | null;
  confidence?: number | null;
  aiSummary?: string | null;
}): SimpleForecast {
  const { countryName, inflationRate, trend, riskLevel, confidence, aiSummary } = params;
  const rate = inflationRate ?? 0;
  const t = (trend ?? "stable").toLowerCase();

  let currentSituation = "Prices are relatively stable.";
  if (rate > 15) currentSituation = "Prices are rising quickly.";
  else if (rate > 8) currentSituation = "Prices are increasing at a noticeable pace.";
  else if (rate > 3) currentSituation = "Prices are increasing slowly.";
  else if (rate < 0) currentSituation = "Prices are falling slightly.";

  let expectedTrend = "Prices may stay roughly the same over the next few months.";
  if (t === "up") expectedTrend = "Prices may continue rising over the next three months.";
  else if (t === "down") expectedTrend = "Price increases may slow down in the coming months.";

  const riskNorm = (riskLevel ?? "medium").toLowerCase();
  const risk: SimpleForecast["riskLevel"] =
    riskNorm === "low" ? "Low" : riskNorm === "high" || riskNorm === "critical" ? "High" : "Moderate";

  const conf = confidence != null ? (confidence <= 1 ? confidence * 100 : confidence) : 70;
  const confidenceLabel =
    conf >= 80 ? "High confidence" : conf >= 60 ? "Moderate confidence" : "Lower confidence";

  const defaultSummary = `Prices are ${
    rate > 10 ? "rising noticeably" : rate > 4 ? "rising moderately" : "fairly stable"
  } in ${countryName}. Food and transportation costs may shift over the next few months.`;

  return {
    currentSituation,
    expectedTrend,
    riskLevel: risk,
    confidenceLabel,
    bestCase: "Prices rise more slowly than expected — your everyday costs stay manageable.",
    normalCase: "Prices follow the usual pattern — budget for a small increase in groceries and transport.",
    worstCase: "Prices rise faster than expected — consider saving extra and comparing prices.",
    aiSummary: aiSummary?.replace(/\b(CPI|PPI|FRED|TS-Transformer)\b/gi, "price trends") ?? defaultSummary,
  };
}

export const PERSONAL_IMPACT_TOPICS = [
  {
    key: "food",
    title: "Food Prices",
    icon: "🛒",
    template: (rising: boolean) =>
      rising
        ? "You may spend slightly more on groceries over the coming months."
        : "Grocery costs may stay relatively steady.",
  },
  {
    key: "transport",
    title: "Transportation",
    icon: "🚌",
    template: (rising: boolean) =>
      rising
        ? "Fuel and transport fares could increase — plan commute and travel costs."
        : "Transport costs may remain fairly stable.",
  },
  {
    key: "rent",
    title: "Rent",
    icon: "🏠",
    template: (rising: boolean) =>
      rising
        ? "Housing costs may edge up — review your rent budget."
        : "Rent pressures may stay moderate in the near term.",
  },
  {
    key: "savings",
    title: "Savings",
    icon: "💰",
    template: (rising: boolean) =>
      rising
        ? "Inflation can reduce purchasing power — consider keeping an emergency fund."
        : "Your savings may hold value better while prices are stable.",
  },
  {
    key: "purchasing",
    title: "Purchasing Power",
    icon: "🛍️",
    template: (rising: boolean) =>
      rising
        ? "The same amount of money may buy fewer goods over time."
        : "Your money should stretch similarly to today.",
  },
  {
    key: "fuel",
    title: "Fuel Prices",
    icon: "⛽",
    template: (rising: boolean) =>
      rising
        ? "Fuel prices may climb — factor this into driving and delivery costs."
        : "Fuel costs may not change dramatically soon.",
  },
  {
    key: "business",
    title: "Business Costs",
    icon: "🏢",
    template: (rising: boolean) =>
      rising
        ? "Input costs for businesses may rise — prices you pay could follow."
        : "Business operating costs may remain manageable.",
  },
] as const;

export const EDUCATION_TOPICS = [
  {
    slug: "inflation",
    title: "What is Inflation?",
    summary:
      "Inflation means the general level of prices goes up over time. When inflation is moderate, a loaf of bread might cost a little more each year than the last.",
    example: "If milk was ₦500 last year and ₦550 today, that increase is inflation at work.",
  },
  {
    slug: "deflation",
    title: "What is Deflation?",
    summary:
      "Deflation is when prices fall across the economy. It sounds good, but it can signal weak demand and job losses.",
    example: "If shops keep cutting prices because fewer people are buying, that can be deflation.",
  },
  {
    slug: "why-prices-rise",
    title: "Why Prices Increase",
    summary:
      "Prices rise when demand grows, supply is disrupted, currencies weaken, or production costs (fuel, wages) go up.",
    example: "Higher fuel costs often make transport and food more expensive.",
  },
  {
    slug: "interest-rates",
    title: "Interest Rates Explained",
    summary:
      "Interest is what you pay to borrow money or earn when you save. Central banks raise rates to cool inflation.",
    example: "When loan rates rise, people may spend less, which can slow price increases.",
  },
  {
    slug: "exchange-rates",
    title: "Currency Exchange Explained",
    summary:
      "Exchange rates tell you how much of one currency you get for another. A weaker local currency makes imports cost more.",
    example: "If the naira weakens against the dollar, imported goods may cost more locally.",
  },
  {
    slug: "savings",
    title: "Savings During Inflation",
    summary:
      "During inflation, cash loses buying power. Keeping emergency savings and comparing returns helps protect you.",
    example: "If prices rise 10% but your savings earn 5%, your money buys less than before.",
  },
  {
    slug: "investing",
    title: "Investing During Inflation",
    summary:
      "Some assets (like productive businesses or inflation-linked instruments) may hold value better than cash alone.",
    example: "Diversifying — not putting everything in one place — reduces risk.",
  },
] as const;