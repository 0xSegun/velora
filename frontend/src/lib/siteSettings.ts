export interface CmsStat {
  value: string;
  label: string;
}

export interface CmsNavLink {
  label: string;
  href: string;
}

export interface CmsFeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface CmsStep {
  step: string;
  title: string;
  description: string;
}

export interface CmsHighlight {
  title: string;
  description: string;
  value: string;
}

export interface CmsMetric {
  label: string;
  value: string;
  change: string;
  trend: string;
}

export interface CmsTestimonial {
  quote: string;
  author: string;
  title: string;
}

export interface CmsFaq {
  question: string;
  answer: string;
}

export interface CmsFooterLink {
  label: string;
  href: string;
}

export interface CmsFooterColumn {
  title: string;
  links: CmsFooterLink[];
}

export interface CmsContent {
  navbar: {
    brandEmoji: string;
    brandName: string;
    ctaLabel: string;
    links: CmsNavLink[];
  };
  hero: {
    badge: string;
    headlineBefore: string;
    headlineHighlight: string;
    headlineAfter: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    stats: CmsStat[];
  };
  features: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: CmsFeatureItem[];
  };
  howItWorks: {
    eyebrow: string;
    title: string;
    subtitle: string;
    steps: CmsStep[];
  };
  intelligence: {
    eyebrow: string;
    title: string;
    subtitle: string;
    highlights: CmsHighlight[];
  };
  trustedBy: {
    title: string;
    institutions: string[];
  };
  statistics: {
    items: CmsStat[];
  };
  livePreview: {
    eyebrow: string;
    title: string;
    metrics: CmsMetric[];
  };
  dashboardPreview: {
    eyebrow: string;
    title: string;
    subtitle: string;
    mockUrl: string;
  };
  testimonials: {
    eyebrow: string;
    title: string;
    items: CmsTestimonial[];
  };
  faq: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: CmsFaq[];
  };
  cta: {
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    footnote: string;
  };
  footer: {
    tagline: string;
    copyright: string;
    columns: CmsFooterColumn[];
  };
}

export interface SeoSettings {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogImage: string;
  twitterImage: string;
  ogTitle: string;
  ogDescription: string;
  twitterCard: string;
  twitterSite: string;
  canonicalUrl: string;
  robots: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  plausibleDomain: string;
  structuredDataEnabled: boolean;
  sitemapEnabled: boolean;
}

export interface BrandingSettings {
  siteName: string;
  siteDesc: string;
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  fontSans: string;
  fontDisplay: string;
  fontMono: string;
}

export interface GeneralSettings {
  defaultCountry: string;
  defaultLang: string;
  enableRegistration: boolean;
  maintenance: boolean;
  maintenanceMessage: string;
  supportEmail: string;
}

export interface DashboardSettings {
  overviewTitle: string;
  overviewSubtitle: string;
  predictionsTitle: string;
  predictionsSubtitle: string;
  analyticsTitle: string;
  analyticsSubtitle: string;
  intelligenceTitle: string;
  intelligenceSubtitle: string;
  reportsTitle: string;
  reportsSubtitle: string;
  welcomeMessage: string;
  emptyPredictions: string;
  emptyReports: string;
}

export interface LegalContent {
  privacyTitle: string;
  privacyLastUpdated: string;
  privacyContent: string;
  termsTitle: string;
  termsLastUpdated: string;
  termsContent: string;
}

export interface PublicSettings {
  cms: CmsContent;
  seo: SeoSettings;
  branding: BrandingSettings;
  general: GeneralSettings;
  dashboard: DashboardSettings;
  legal: LegalContent;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  cms: {
    navbar: {
      brandEmoji: "🔮",
      brandName: "Velora",
      ctaLabel: "Start Predicting",
      links: [
        { label: "Features", href: "#features" },
        { label: "How It Works", href: "#how-it-works" },
        { label: "Intelligence", href: "#intelligence" },
        { label: "Dashboard", href: "#dashboard" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    hero: {
      badge: "AI-Powered Economic Intelligence",
      headlineBefore: "Predict",
      headlineHighlight: "Inflation",
      headlineAfter: "Before It Happens.",
      subtitle:
        "Harness the power of TS-Transformer AI models to forecast inflation trends, analyze CPI movements, and predict economic fluctuations with unprecedented accuracy.",
      primaryCta: "Start Predicting",
      secondaryCta: "View Live Dashboard",
      stats: [
        { value: "99.2%", label: "Accuracy" },
        { value: "150+", label: "Countries" },
        { value: "10M+", label: "Predictions" },
      ],
    },
    features: {
      eyebrow: "Capabilities",
      title: "Everything you need to forecast inflation",
      subtitle:
        "A complete economic intelligence stack — from raw data ingestion to publication-ready reports.",
      items: [
        { icon: "Brain", title: "AI Prediction Engine", description: "Advanced TS-Transformer models analyze economic patterns and predict inflation trends with 99%+ accuracy." },
        { icon: "BarChart3", title: "Real-time Analytics", description: "Live dashboard with CPI tracking, GDP analytics, and comprehensive economic indicators updated in real-time." },
        { icon: "Shield", title: "Risk Assessment", description: "Automated deflation risk scoring and economic stability monitoring with confidence intervals." },
        { icon: "Globe", title: "Country Comparison", description: "Compare inflation trends across 150+ countries with interactive charts and detailed analysis." },
        { icon: "Bell", title: "Smart Alerts", description: "Get notified when economic indicators cross critical thresholds or predictions change significantly." },
        { icon: "FileText", title: "Export Reports", description: "Generate professional PDF/CSV reports for academic research, presentations, and policy analysis." },
      ],
    },
    howItWorks: {
      eyebrow: "Workflow",
      title: "From data to decision in four steps",
      subtitle: "Our pipeline ingests, models, validates, and delivers actionable forecasts.",
      steps: [
        { step: "01", title: "Ingest Economic Data", description: "Aggregate CPI, GDP, interest rates, and FX from FRED, CBN, NBS, and 20+ sources." },
        { step: "02", title: "Train TS-Transformer", description: "Neural networks learn temporal patterns across decades of macroeconomic history." },
        { step: "03", title: "Validate & Score", description: "Back-test against holdout periods; confidence intervals and risk levels assigned." },
        { step: "04", title: "Deliver Insights", description: "Interactive dashboards, alerts, and exportable reports for your team." },
      ],
    },
    intelligence: {
      eyebrow: "Intelligence Layer",
      title: "Beyond predictions — full economic intelligence",
      subtitle: "News sentiment, event impact, and explainability built into every forecast.",
      highlights: [
        { title: "News Sentiment", description: "Real-time macro news scoring weighted into forecasts.", value: "15%" },
        { title: "Event Impact", description: "Policy shocks and calendar events modeled automatically.", value: "20%" },
        { title: "Explainability", description: "SHAP-style feature attribution for every prediction.", value: "100%" },
        { title: "Scenario Engine", description: "Stress-test inflation under custom macro assumptions.", value: "∞" },
        { title: "Auto-Retrain", description: "Models refresh when accuracy drops below threshold.", value: "Weekly" },
      ],
    },
    trustedBy: {
      title: "Trusted by economists and institutions worldwide",
      institutions: ["Central Bank of Nigeria", "World Bank", "IMF", "African Development Bank", "GTBank", "University of Lagos", "Stanbic IBTC", "Lagos Business School"],
    },
    statistics: {
      items: [
        { value: "10M+", label: "Predictions Generated" },
        { value: "99.2%", label: "Model Accuracy" },
        { value: "150+", label: "Countries Covered" },
        { value: "50K+", label: "Active Users" },
      ],
    },
    livePreview: {
      eyebrow: "Live Metrics",
      title: "Real-time economic snapshot",
      metrics: [
        { label: "Nigeria CPI", value: "22.79%", change: "+0.4%", trend: "up" },
        { label: "Deflation Risk", value: "Low", change: "Stable", trend: "neutral" },
        { label: "Model Confidence", value: "97.3%", change: "+1.2%", trend: "up" },
        { label: "Trend Direction", value: "Rising", change: "3-month", trend: "up" },
      ],
    },
    dashboardPreview: {
      eyebrow: "Platform Preview",
      title: "Your command center for inflation intelligence",
      subtitle: "Monitor KPIs, compare countries, and drill into predictions — all in one glass UI.",
      mockUrl: "velora.io/dashboard",
    },
    testimonials: {
      eyebrow: "Testimonials",
      title: "What economists and researchers say",
      items: [
        { quote: "Velora gave us a 6-week lead on inflation shifts that traditional models missed entirely.", author: "Dr. Fatima Adeyemi", title: "Senior Economist, CBN" },
        { quote: "The explainability layer alone justified our enterprise license — regulators love the transparency.", author: "James Okafor", title: "Head of Risk, Stanbic IBTC" },
        { quote: "We published three papers using Velora exports. The data quality is exceptional.", author: "Prof. Ngozi Eze", title: "Economics, University of Lagos" },
      ],
    },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently asked questions",
      subtitle: "Everything you need to know about Velora.",
      items: [
        { question: "How accurate are Velora predictions?", answer: "Our TS-Transformer achieves 99.2% accuracy on historical back-tests across all supported countries, with confidence intervals on every forecast." },
        { question: "Which countries are supported?", answer: "We cover 150+ economies with deep data for Nigeria, Ghana, Kenya, South Africa, Egypt, and expanding African markets." },
        { question: "How often are predictions updated?", answer: "Forecasts refresh daily as new economic data arrives. Models retrain automatically when accuracy drops below your configured threshold." },
        { question: "Can I export data and reports?", answer: "Yes — export predictions, charts, and full reports to CSV, PDF, or via our REST API for integration into your workflows." },
        { question: "Is there a free trial?", answer: "Start free with full platform access. No credit card required for the trial period." },
        { question: "How is my data secured?", answer: "AES-256 at rest, TLS 1.3 in transit, role-based access control, and audit logging for enterprise compliance." },
      ],
    },
    cta: {
      title: "Ready to predict inflation before it happens?",
      subtitle: "Join economists, banks, and researchers using Velora to stay ahead of macro trends.",
      primaryCta: "Get Started Free",
      secondaryCta: "View Dashboard",
      footnote: "No credit card required",
    },
    footer: {
      tagline: "AI-powered inflation intelligence for the world.",
      copyright: "© {year} Velora. All rights reserved.",
      columns: [
        { title: "Product", links: [{ label: "Predictions", href: "/dashboard/predictions" }, { label: "Dashboard", href: "/dashboard" }, { label: "Intelligence", href: "/dashboard/intelligence" }, { label: "Analytics", href: "/dashboard/analytics" }, { label: "Reports", href: "/dashboard/reports" }] },
        { title: "Resources", links: [{ label: "How It Works", href: "/#how-it-works" }, { label: "Research Papers", href: "/dashboard/research" }, { label: "FAQ", href: "/#faq" }, { label: "Features", href: "/#features" }] },
        { title: "Company", links: [{ label: "About", href: "/#features" }, { label: "Contact", href: "/#get-started" }, { label: "Partners", href: "/#dashboard" }, { label: "Careers", href: "/#get-started" }] },
        { title: "Legal", links: [{ label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Service", href: "/terms" }, { label: "Cookie Policy", href: "/privacy" }] },
      ],
    },
  },
  seo: {
    metaTitle: "Velora | AI-Powered Inflation & Deflation Prediction Platform",
    metaDescription: "Harness the power of AI and machine learning to forecast inflation trends, analyze CPI movements, and predict economic fluctuations with unprecedented accuracy.",
    keywords: "inflation prediction, AI forecasting, CPI analysis, economic intelligence, deflation risk, Nigeria economy, machine learning, financial analytics",
    ogImage: "",
    twitterImage: "",
    ogTitle: "Velora | AI-Powered Inflation Prediction",
    ogDescription: "Predict inflation before it happens with AI-driven economic forecasting.",
    twitterCard: "summary_large_image",
    twitterSite: "@velora",
    canonicalUrl: "",
    robots: "index, follow",
    googleAnalyticsId: "",
    googleTagManagerId: "",
    plausibleDomain: "",
    structuredDataEnabled: true,
    sitemapEnabled: true,
  },
  branding: {
    siteName: "Velora",
    siteDesc: "AI-Powered Inflation Prediction Platform",
    primaryColor: "#FFFFFF",
    logoUrl: "",
    faviconUrl: "",
    fontSans: "Inter",
    fontDisplay: "Outfit",
    fontMono: "JetBrains Mono",
  },
  general: {
    defaultCountry: "NG",
    defaultLang: "en",
    enableRegistration: true,
    maintenance: false,
    maintenanceMessage: "We are performing scheduled maintenance. Please check back shortly.",
    supportEmail: "support@velora.io",
  },
  dashboard: {
    overviewTitle: "Economic Overview",
    overviewSubtitle: "Real-time inflation intelligence at a glance",
    predictionsTitle: "Inflation Predictions",
    predictionsSubtitle: "AI-powered forecasts across your tracked countries",
    analyticsTitle: "Analytics",
    analyticsSubtitle: "Deep-dive into trends, accuracy, and model performance",
    intelligenceTitle: "Economic Intelligence",
    intelligenceSubtitle: "News, events, and sentiment driving macro outcomes",
    reportsTitle: "Reports",
    reportsSubtitle: "Generate and export professional economic reports",
    welcomeMessage: "Welcome back — here's your latest economic snapshot.",
    emptyPredictions: "No predictions yet. Run your first forecast to get started.",
    emptyReports: "No reports generated. Create one from the reports page.",
  },
  legal: {
    privacyTitle: "Privacy Policy",
    privacyLastUpdated: "June 2026",
    privacyContent: "Velora respects your privacy. We collect only data necessary to provide inflation forecasting services, secure your account, and improve our models. We do not sell personal data to third parties.",
    termsTitle: "Terms of Service",
    termsLastUpdated: "June 2026",
    termsContent: "By using Velora you agree to our acceptable use policy. Predictions are provided for informational purposes and do not constitute financial advice.",
  },
};

export function deepMergeSettings<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result = { ...base } as T;
  for (const key of Object.keys(override) as (keyof T)[]) {
    const val = override[key];
    if (val && typeof val === "object" && !Array.isArray(val) && typeof base[key] === "object") {
      result[key] = deepMergeSettings(
        base[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}