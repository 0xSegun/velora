import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { Notification } from "@/store/dashboardStore";
import type { SearchResponse } from "@/types/search";
import { logError } from "@/lib/errorHandler";
import { MESSAGES, toast } from "@/lib/feedback";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type JsonRecord = Record<string, unknown>;

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
  fullName?: string;
  country?: string;
  role?: "user" | "analyst";
  [key: string]: unknown;
}

const getBrowserStorageItem = (key: string) =>
  typeof window === "undefined" ? null : window.localStorage.getItem(key);

import { clearAuthCookies } from "./authCookies";

export const clearAuthTokens = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("access_token");
  window.localStorage.removeItem("refresh_token");
  clearAuthCookies();
};

const mapNotification = (raw: JsonRecord): Notification => ({
  id: String(raw.id),
  title: String(raw.title ?? "Notification"),
  message: String(raw.message ?? ""),
  type: String(raw.type ?? "info") as Notification["type"],
  isRead: Boolean(raw.isRead ?? raw.is_read),
  createdAt: String(
    raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  ),
});

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

let lastNetworkToast = 0;
const NETWORK_TOAST_COOLDOWN_MS = 4000;

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getBrowserStorageItem("refresh_token");
    if (!refreshToken) {
      throw new Error("No refresh token");
    }
    const { data } = await axios.post<{
      access_token: string;
      refresh_token?: string;
    }>(`${API_URL}/api/auth/refresh`, { refresh_token: refreshToken });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) {
        window.localStorage.setItem("refresh_token", data.refresh_token);
      }
    }
    return data.access_token;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function maybeShowNetworkToast(error: AxiosError) {
  if (error.response) return;
  const now = Date.now();
  if (now - lastNetworkToast < NETWORK_TOAST_COOLDOWN_MS) return;
  lastNetworkToast = now;

  if (error.code === "ECONNABORTED") {
    toast.error(MESSAGES.network.timeout);
  } else if (typeof navigator !== "undefined" && !navigator.onLine) {
    toast.error(MESSAGES.network.offline);
  } else {
    toast.error(MESSAGES.network.serverOffline);
  }
}

// Request interceptor - attach JWT token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getBrowserStorageItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle 401, refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (error.response?.status === 401 && originalRequest) {
      const refreshToken = getBrowserStorageItem("refresh_token");
      if (refreshToken && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const accessToken = await refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          clearAuthTokens();
          if (typeof window !== "undefined") window.location.href = "/login";
        }
      }
    }
    logError("API request failed", error);
    maybeShowNetworkToast(error);
    return Promise.reject(error);
  },
);

// Typed API methods
export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
  mfaVerify: (challenge_token: string, code: string) =>
    api.post("/api/auth/mfa-verify", { challenge_token, code }),
  register: (data: RegisterPayload) => api.post("/api/auth/register", data),
  googleLogin: (credential: string) =>
    api.post("/api/auth/google", { credential }),
  getGoogleConfig: () =>
    api.get<{ enabled: boolean; client_id: string; redirect_uri: string }>(
      "/api/auth/google-config",
    ),
  forgotPassword: (email: string) =>
    api.post("/api/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) =>
    api.post("/api/auth/reset-password", { token, new_password: password }),
  verifyEmail: (token: string) =>
    api.post("/api/auth/verify-email", { token }),
  getDefaultAdmin: () =>
    api.get<{ email: string; password: string; name: string } | null>(
      "/api/auth/default-admin",
    ),
  refreshToken: () =>
    api.post("/api/auth/refresh", {
      refresh_token: getBrowserStorageItem("refresh_token"),
    }),
  me: () => api.get("/api/auth/me"),
  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      clearAuthTokens();
    }
  },
};

export const usersAPI = {
  getProfile: () => api.get("/api/users/profile"),
  updateProfile: (data: JsonRecord) => api.put("/api/users/profile", data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post("/api/auth/change-password", data),
};

export const predictionsAPI = {
  forecast: (data: JsonRecord) => api.post("/api/predictions/forecast", data),
  getHistory: (params?: JsonRecord) =>
    api.get("/api/predictions/history", { params }),
  getByCountry: (code: string) => api.get(`/api/predictions/countries/${code}`),
  compare: (country_codes: string[], forecast_horizon = 6) =>
    api.post("/api/predictions/compare", { country_codes, forecast_horizon }),
  getLatest: () => api.get("/api/predictions/latest"),
  getById: (id: string) => api.get(`/api/predictions/${id}`),
};

export interface CountryRecord {
  id: string;
  name: string;
  code: string;
  flag: string;
  flag_url?: string | null;
  region?: string | null;
  continent?: string | null;
  currency?: string | null;
  inflation_rate: number;
  deflation_risk: number;
  gdp: number;
  interest_rate: number;
  economic_stability_score: number;
  currency_strength: number;
  updated_at: string;
  exchange_rate?: number | null;
  exchange_rate_last_updated?: string | null;
  exchange_rate_trend?: string | null;
  exchange_rate_change_24h?: number | null;
  exchange_rate_change_7d?: number | null;
  exchange_rate_is_stale?: boolean;
  exchange_rate_stale_message?: string | null;
}

export const countriesAPI = {
  list: async (params?: JsonRecord) => {
    const { data } = await api.get<{
      countries: CountryRecord[];
      total: number;
      page: number;
      per_page: number;
    }>("/api/countries", { params: { per_page: 500, ...params } });
    return data;
  },
  getCatalog: () =>
    api.get<{
      countries: Array<{
        code: string;
        name: string;
        flag: string;
        flag_url: string;
        currency?: string;
        currency_name?: string;
        currency_symbol?: string;
        continent?: string;
        region?: string;
      }>;
      total: number;
    }>("/api/countries/catalog"),
  getByCode: (code: string) => api.get<CountryRecord>(`/api/countries/${code}`),
};

export const economicDataAPI = {
  getLatest: (params?: JsonRecord) =>
    api.get("/api/economic-data/latest", { params }),
  getByCountry: (code: string) =>
    api.get(`/api/economic-data/countries/${code}`),
  getHistorical: (params: JsonRecord) =>
    api.get("/api/economic-data/historical", { params }),
  getNigeria: () => api.get("/api/economic-data/nigeria"),
  sync: () => api.post("/api/economic-data/sync"),
};

export const publicAPI = {
  getSettings: () => api.get("/api/public/settings"),
  getMaintenance: () => api.get("/api/public/maintenance"),
  trackPageView: (data: JsonRecord) =>
    api.post("/api/public/track/page-view", data),
};

export const adminAPI = {
  getDashboard: () => api.get("/api/admin/dashboard"),
  getSettings: () => api.get("/api/admin/settings"),
  getSettingsBundle: () => api.get("/api/admin/settings/bundle"),
  updateSettingsBundle: (data: JsonRecord) =>
    api.put("/api/admin/settings/bundle", data),
  updateSettings: (data: JsonRecord) => api.put("/api/admin/settings", data),
  updateCredentials: (data: JsonRecord) =>
    api.put("/api/admin/credentials", data),
  uploadBrandingAsset: (assetType: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/admin/branding/upload?asset_type=${assetType}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getUsers: (params?: JsonRecord) => api.get("/api/users/", { params }),
  updateUser: (id: string, data: JsonRecord) =>
    api.put(`/api/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/api/users/${id}`),
  getModels: () => api.get("/api/admin/models"),
  trainModel: () => api.post("/api/admin/models/train"),
  getSystemHealth: () => api.get("/api/admin/system-health"),
  getAnalytics: (params?: JsonRecord) =>
    api.get("/api/admin/analytics", { params }),
  getGoogleOAuth: () => api.get("/api/admin/auth/google"),
  updateGoogleOAuth: (data: JsonRecord) => api.put("/api/admin/auth/google", data),
  testGoogleOAuth: () => api.post("/api/admin/auth/google/test"),
  getComprehensiveAnalytics: (days = 30) =>
    api.get("/api/analytics/comprehensive", { params: { days } }),
  resetAnalytics: () => api.post("/api/analytics/reset"),
  getAnalyticsConfig: () => api.get("/api/analytics/config"),
  updateAnalyticsConfig: (data: JsonRecord) => api.put("/api/analytics/config", data),
  exportAnalyticsCsv: (days = 30) =>
    api.get("/api/analytics/export/csv", { params: { days }, responseType: "blob" }),
  exportAnalyticsJson: (days = 30) =>
    api.get("/api/analytics/export/json", { params: { days }, responseType: "blob" }),
  getEconomicDataManagement: () => api.get("/api/admin/economic-data"),
  syncEconomicData: () => api.post("/api/admin/economic-data/sync"),
};

export interface ServerTime {
  utc: string;
  local: string;
  timezone: string;
  timezone_abbrev: string;
  weekday: string;
  date_label: string;
  time_label: string;
}

export interface EconomicHealthItem {
  label: string;
  value: number | null;
  suffix?: string;
  trend_direction: string;
  trend_label: string;
  explanation: string;
}

export interface AIInsights {
  summary: string;
  key_drivers: string[];
  risks: string[];
  opportunities: string[];
  confidence_level: number | null;
}

export interface DashboardIndicator {
  key: string;
  label: string;
  value: number | null;
  previous_value: number | null;
  change: number | null;
  trend_direction: string;
  suffix: string;
  source: string | null;
  last_updated: string | null;
  available: boolean;
  unavailable_message: string | null;
  is_stale?: boolean;
  stale_message?: string | null;
  change_24h?: number | null;
  change_7d?: number | null;
  change_24h_pct?: number | null;
  change_7d_pct?: number | null;
}

export interface DashboardCountryCard {
  code: string;
  name: string;
  flag: string;
  flag_url?: string;
  currency?: string | null;
  currency_name?: string | null;
  currency_symbol?: string | null;
  location?: string;
  featured?: boolean;
  metrics: {
    inflation_rate: number | null;
    deflation_risk: number | null;
    gdp_growth: number | null;
    interest_rate: number | null;
    exchange_rate: number | null;
    exchange_rate_detail?: ExchangeRateDetail;
    economic_stability_score: number | null;
    currency_strength: number | null;
    data_source?: string | null;
    last_updated?: string | null;
    indicators: DashboardIndicator[];
  };
  economic_health: EconomicHealthItem[];
  ai_insights: AIInsights;
  prediction: {
    id: string;
    inflation_rate: number;
    trend_direction: string;
    confidence_score: number;
    risk_level: string;
    ai_summary?: string | null;
    forecast_horizon?: number;
    created_at: string;
  } | null;
}

export interface ComparisonCountry {
  code: string;
  name: string;
  flag: string;
  inflation_rate: number | null;
  gdp_growth: number | null;
  interest_rate: number | null;
  currency_strength: number | null;
  stability_score: number | null;
  primary_inflation: number | null;
  primary_gdp: number | null;
  primary_interest: number | null;
  primary_currency: number | null;
  primary_stability: number | null;
}

export interface ComparisonData {
  primary: { code: string; name: string; flag: string };
  countries: ComparisonCountry[];
}

export interface DashboardOverview {
  server_time: ServerTime;
  location?: string;
  primary_country: DashboardCountryCard;
  tracked_countries: DashboardCountryCard[];
  comparison: ComparisonData;
  key_indicators: DashboardIndicator[];
  recent_predictions: Array<{
    id: string;
    country_code: string;
    inflation_rate: number;
    trend_direction: string;
    confidence_score: number;
    created_at: string;
  }>;
  max_tracked: number;
}

export interface UserInsights {
  country_code: string;
  country_name: string;
  server_time?: ServerTime;
  tracked_countries?: string[];
  todays_summary: {
    economic_health: string;
    economic_health_score: number;
    inflation_trend: string;
    inflation_rate: number | null;
    deflation_risk: number | null;
    currency_strength: number | null;
    currency_trend: string;
    ai_summary: string;
  };
  cost_of_living: Record<string, string>;
  savings_advisor: string[];
  charts: Record<string, Array<{ date: string; label: string; value: number }>>;
  gauges: {
    economic_health: number;
    forecast_confidence: number;
    risk_level: string;
    sentiment_score: number;
  };
  quick_forecasts: Record<string, string | number>;
  recent_events: Array<{ title: string; date: string; category: string; impact: number }>;
  recent_news: Array<JsonRecord>;
  weekly_summary: string;
  ai_recommendations: string[];
}

export const dashboardAPI = {
  getOverview: () => api.get<DashboardOverview>("/api/dashboard/overview"),
  getUserInsights: (countryCode?: string) =>
    api.get<UserInsights>("/api/dashboard/user-insights", {
      params: countryCode ? { country_code: countryCode } : {},
    }),
  getBriefing: (
    period: "morning" | "weekly" | "monthly" = "morning",
    countryCode?: string,
  ) =>
    api.get("/api/dashboard/briefing", {
      params: {
        period,
        ...(countryCode ? { country_code: countryCode } : {}),
      },
    }),
  getServerTime: () => api.get<ServerTime>("/api/dashboard/server-time"),
  getTrackedCountries: () => api.get<{ countries: string[]; max: number }>("/api/dashboard/tracked-countries"),
  updateTrackedCountries: (countries: string[]) =>
    api.put("/api/dashboard/tracked-countries", { countries }),
};

export const getAnalyticsWebSocketUrl = () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  if (typeof window === "undefined") return null;
  const wsBase = API_URL.replace(/^http/, "ws");
  return `${wsBase}/api/analytics/ws`;
};

export const notificationsAPI = {
  list: async () => {
    const { data } = await api.get<
      JsonRecord[] | { notifications: JsonRecord[] }
    >("/api/notifications");
    const items = Array.isArray(data) ? data : data.notifications;
    return items.map(mapNotification);
  },
  unreadCount: async () => {
    const { data } = await api.get<{
      unread_count?: number;
      unreadCount?: number;
    }>("/api/notifications/unread-count");
    return data.unread_count ?? data.unreadCount ?? 0;
  },
  markAsRead: (id: string) => api.patch(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.patch("/api/notifications/read-all"),
  delete: (id: string) => api.delete(`/api/notifications/${id}`),
};

export const reportsAPI = {
  list: (params?: JsonRecord) => api.get("/api/reports", { params }),
  getById: (id: string) => api.get(`/api/reports/${id}`),
  create: (data: JsonRecord) => api.post("/api/reports", data),
  generate: (data: {
    country_code: string;
    horizon_months?: number;
    report_type?: string;
    indicator_focus?: string;
  }) => api.post("/api/reports/generate", data),
  download: (id: string) =>
    api.get(`/api/reports/${id}/download`, { responseType: "blob" }),
  sync: () => api.post("/api/reports/sync"),
};

export interface ApiHealthMetrics {
  response_time_ms?: number | null;
  last_successful_sync?: string | null;
  last_failed_sync?: string | null;
  usage_count?: number;
  error_rate?: number;
  success_rate?: number | null;
  last_status_code?: number | null;
}

export interface ApiConfigRecord {
  id: string;
  name: string;
  provider: string;
  api_type: string;
  endpoint_url: string;
  base_url?: string | null;
  api_key_set: boolean;
  credentials_set?: Record<string, boolean>;
  custom_headers?: Record<string, string>;
  refresh_frequency_hours: number;
  source_priority: number;
  country_filters: string[];
  report_categories: string[];
  is_active: boolean;
  health_status: string;
  health_metrics?: ApiHealthMetrics;
  last_tested_at: string | null;
  last_sync_at: string | null;
  last_failed_sync_at?: string | null;
  usage_stats: Record<string, unknown>;
  logs: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRateConfig {
  id: string;
  provider_name: string;
  api_key_masked: string;
  api_key_set: boolean;
  base_url: string;
  base_currency: string;
  refresh_interval: string;
  is_active: boolean;
  last_sync: string | null;
  next_sync: string | null;
  sync_status: string;
  error_count: number;
  success_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRateCountryData {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_name?: string | null;
  currency_symbol?: string | null;
  exchange_rate: number | null;
  change_24h?: number | null;
  change_7d?: number | null;
  change_24h_pct?: number | null;
  change_7d_pct?: number | null;
  trend: string;
  last_updated: string | null;
  is_stale: boolean;
  stale_message?: string | null;
}

export interface ExchangeRateDetail {
  rate: number | null;
  change_24h?: number | null;
  change_7d?: number | null;
  change_24h_pct?: number | null;
  change_7d_pct?: number | null;
  trend: string;
  last_updated?: string | null;
  is_stale: boolean;
  stale_message?: string | null;
  currency_code?: string;
  currency_name?: string | null;
  currency_symbol?: string | null;
}

export interface ExchangeRateAuditLog {
  id: string;
  action: string;
  changed_fields: Record<string, unknown>;
  admin_user_id: string | null;
  admin_email?: string | null;
  created_at: string;
}

export interface ResendConfig {
  id: string;
  provider_name: string;
  api_key_masked: string;
  api_key_set: boolean;
  base_url: string;
  from_email: string | null;
  reply_to: string | null;
  open_tracking: boolean;
  click_tracking: boolean;
  is_active: boolean;
  last_sync: string | null;
  error_count: number;
  success_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResendAuditLog {
  id: string;
  action: string;
  changed_fields: Record<string, unknown>;
  admin_user_id: string | null;
  admin_email?: string | null;
  created_at: string;
}

export interface ResendStatistics {
  summary: Record<string, unknown>;
  event_breakdown: Array<{ event: string; count: number }>;
  domains: Array<Record<string, unknown>>;
  recent_emails: Array<Record<string, unknown>>;
  contacts_sample: Array<Record<string, unknown>>;
  broadcasts: Array<Record<string, unknown>>;
  api_usage: Array<Record<string, unknown>>;
}

export const resendAPI = {
  getConfig: () => api.get<ResendConfig>("/api/admin/resend-config"),
  updateConfig: (data: JsonRecord) => api.put("/api/admin/resend-config", data),
  testConnection: (data?: { api_key?: string }) =>
    api.post("/api/admin/resend-config/test", data ?? {}),
  sendTestEmail: (data: { to: string; api_key?: string }) =>
    api.post("/api/admin/resend-config/send-test", data),
  enable: () => api.post("/api/admin/resend-config/enable"),
  disable: () => api.post("/api/admin/resend-config/disable"),
  getHealth: () => api.get("/api/admin/resend-config/health"),
  getLogs: (params?: { status?: string; limit?: number }) =>
    api.get("/api/admin/resend-config/logs", { params }),
  getAuditLogs: (params?: { limit?: number }) =>
    api.get<ResendAuditLog[]>("/api/admin/resend-config/audit-logs", { params }),
  getStatistics: () => api.get<ResendStatistics>("/api/admin/resend/statistics"),
  listEmails: (params?: { limit?: number }) =>
    api.get("/api/admin/resend/emails", { params }),
  listDomains: () => api.get("/api/admin/resend/domains"),
};

export interface ExchangeRateCatalogItem {
  code: string;
  name: string;
  country: string;
  country_code: string;
  continent: string;
  region: string;
  symbol: string;
  exchange_rate?: number | null;
  last_updated?: string | null;
  base_currency?: string | null;
}

export interface ExchangeRateCatalog {
  total: number;
  base_currency: string;
  supported_codes: string[];
  currencies: ExchangeRateCatalogItem[];
}

export const exchangeRatesAPI = {
  getConfig: () => api.get<ExchangeRateConfig>("/api/admin/exchange-rate-config"),
  updateConfig: (data: JsonRecord) => api.put("/api/admin/exchange-rate-config", data),
  testConnection: (data?: { api_key?: string }) =>
    api.post("/api/admin/exchange-rate-config/test", data ?? {}),
  sync: () => api.post("/api/admin/exchange-rate-config/sync"),
  enable: () => api.post("/api/admin/exchange-rate-config/enable"),
  disable: () => api.post("/api/admin/exchange-rate-config/disable"),
  getHealth: () => api.get("/api/admin/exchange-rate-config/health"),
  getLogs: (params?: { status?: string; endpoint?: string; limit?: number }) =>
    api.get("/api/admin/exchange-rate-config/logs", { params }),
  getAuditLogs: (params?: { limit?: number }) =>
    api.get<ExchangeRateAuditLog[]>("/api/admin/exchange-rate-config/audit-logs", { params }),
  listRates: () => api.get("/api/admin/exchange-rates"),
  listCurrencies: () => api.get<ExchangeRateCatalog>("/api/admin/exchange-rates/currencies"),
  pairConversion: (data: { base_currency: string; target_currency: string; amount?: number }) =>
    api.post("/api/admin/exchange-rates/pair", data),
  providerHistorical: (data: {
    base_currency: string;
    year: number;
    month: number;
    day: number;
    amount?: number;
  }) => api.post("/api/admin/exchange-rates/historical", data),
  enrichedData: (data: { base_currency: string; target_currency: string }) =>
    api.post("/api/admin/exchange-rates/enriched", data),
  getAnalytics: () => api.get("/api/exchange-rates/analytics"),
  getHistory: (params?: { target_currency?: string; period_type?: string; months?: number }) =>
    api.get("/api/admin/exchange-rates/history", { params }),
  getByCountry: (code: string) => api.get<ExchangeRateCountryData>(`/api/exchange-rates/${code}`),
  getByCurrency: (code: string) =>
    api.get<ExchangeRateCountryData>(`/api/exchange-rates/currency/${code}`),
  publicCurrencies: () => api.get<ExchangeRateCatalog>("/api/exchange-rates/currencies"),
};

export interface FredIndicator {
  id: string;
  indicator_code: string;
  indicator_name: string;
  category: string;
  description: string;
  frequency: string;
  field_mapping: string;
  enabled: boolean;
  last_updated?: string | null;
}

export interface FredFeatureConfig {
  include_lag_variables: boolean;
  include_rolling_means: boolean;
  include_moving_averages: boolean;
  include_percentage_changes: boolean;
  include_growth_rates: boolean;
  input_sequence_length: number;
  forecast_horizon: number;
  normalization_method: string;
}

export interface FredConfig {
  id: string;
  provider_name: string;
  api_key_masked: string;
  api_key_set: boolean;
  base_url: string;
  refresh_interval: string;
  date_range: string;
  data_frequency: string;
  prediction_enabled: boolean;
  sync_enabled: boolean;
  historical_storage_enabled: boolean;
  is_active: boolean;
  last_sync?: string | null;
  last_failed_sync?: string | null;
  next_sync?: string | null;
  sync_status: string;
  records_retrieved: number;
  error_count: number;
  success_count: number;
  feature_config: FredFeatureConfig;
  indicators: FredIndicator[];
  created_at: string;
  updated_at: string;
}

export interface FredHealth {
  provider: string;
  status: string;
  is_active: boolean;
  response_time_ms?: number | null;
  last_sync?: string | null;
  last_failed_sync?: string | null;
  next_sync?: string | null;
  error_count: number;
  success_count: number;
  success_rate?: number | null;
  sync_status: string;
  records_retrieved: number;
  indicators_enabled: number;
  data_quality_score?: number | null;
  model_feature_count: number;
  using_cached_data?: boolean;
  failover_warning?: string | null;
}

export const fredAPI = {
  getConfig: () => api.get<FredConfig>("/api/admin/fred-config"),
  updateConfig: (data: JsonRecord) => api.put("/api/admin/fred-config", data),
  testConnection: (data?: { api_key?: string }) =>
    api.post("/api/admin/fred-config/test", data ?? {}),
  sync: () => api.post("/api/admin/fred-config/sync"),
  enable: () => api.post("/api/admin/fred-config/enable"),
  disable: () => api.post("/api/admin/fred-config/disable"),
  reset: () => api.post("/api/admin/fred-config/reset"),
  getHealth: () => api.get<FredHealth>("/api/admin/fred-config/health"),
  getLogs: (params?: { status?: string; endpoint?: string; limit?: number }) =>
    api.get("/api/admin/fred-config/logs", { params }),
  getAuditLogs: (params?: { limit?: number }) =>
    api.get("/api/admin/fred-config/audit-logs", { params }),
  getAnalytics: () => api.get("/api/admin/fred-config/analytics"),
  exportData: (format: string, indicatorCode?: string) =>
    api.get("/api/admin/fred-config/export", {
      params: { format, indicator_code: indicatorCode },
      responseType: "blob",
    }),
};

export interface NewsApiConfig {
  id: string;
  provider: string;
  provider_name: string;
  base_url: string;
  api_key_set: boolean;
  refresh_interval: string;
  sync_enabled: boolean;
  is_active: boolean;
  source_config: {
    sources?: string[];
    queries?: string[];
    country_codes?: string[];
  };
  last_sync?: string | null;
  sync_status: string;
  articles_retrieved: number;
  error_count: number;
  success_count: number;
}

export interface NewsApiHealth {
  status: string;
  provider: string;
  is_active: boolean;
  sync_status: string;
  last_sync?: string | null;
  articles_retrieved: number;
  success_rate?: number | null;
  using_cached_data: boolean;
}

export const newsAPI = {
  getConfig: () => api.get<NewsApiConfig>("/api/admin/news-api"),
  updateConfig: (data: JsonRecord) => api.put("/api/admin/news-api", data),
  testConnection: (data?: { api_key?: string }) =>
    api.post("/api/admin/news-api/test", data ?? {}),
  sync: () => api.post("/api/admin/news-api/sync"),
  enable: () => api.post("/api/admin/news-api/enable"),
  disable: () => api.post("/api/admin/news-api/disable"),
  getHealth: () => api.get<NewsApiHealth>("/api/admin/news-api/health"),
  getLogs: (params?: { limit?: number }) =>
    api.get("/api/admin/news-api/logs", { params }),
};

export interface ImfApiConfig {
  id: string;
  provider_name: string;
  base_url: string;
  api_key_set: boolean;
  refresh_interval: string;
  sync_enabled: boolean;
  is_active: boolean;
  source_config: {
    country_codes?: string[];
    indicators?: string[];
    preferred_year?: number | null;
  };
  last_sync?: string | null;
  sync_status: string;
  countries_synced: number;
  error_count: number;
  success_count: number;
}

export interface ImfApiHealth {
  status: string;
  provider: string;
  is_active: boolean;
  sync_status: string;
  last_sync?: string | null;
  next_sync?: string | null;
  countries_synced: number;
  success_rate?: number | null;
  using_cached_data: boolean;
}

export const imfAPI = {
  getConfig: () => api.get<ImfApiConfig>("/api/admin/imf-api"),
  updateConfig: (data: JsonRecord) => api.put("/api/admin/imf-api", data),
  testConnection: (data?: { api_key?: string; country_code?: string }) =>
    api.post("/api/admin/imf-api/test", data ?? {}),
  sync: () => api.post("/api/admin/imf-api/sync"),
  enable: () => api.post("/api/admin/imf-api/enable"),
  disable: () => api.post("/api/admin/imf-api/disable"),
  getHealth: () => api.get<ImfApiHealth>("/api/admin/imf-api/health"),
  getLogs: (params?: { limit?: number }) =>
    api.get("/api/admin/imf-api/logs", { params }),
};

export interface WikipediaApiConfig {
  id: string;
  provider_name: string;
  base_url: string;
  user_agent: string;
  refresh_interval: string;
  sync_enabled: boolean;
  is_active: boolean;
  source_config: {
    country_codes?: string[];
    economy_title_template?: string;
    central_bank_title_template?: string;
    title_overrides?: Record<string, Record<string, string>>;
  };
  last_sync?: string | null;
  sync_status: string;
  countries_synced: number;
  error_count: number;
  success_count: number;
}

export interface WikipediaApiHealth {
  status: string;
  provider: string;
  is_active: boolean;
  sync_status: string;
  last_sync?: string | null;
  next_sync?: string | null;
  countries_synced: number;
  success_rate?: number | null;
  using_cached_data: boolean;
}

type CountryMacroSnapshot = {
  country_code: string;
  country_name: string;
  data_year?: number | null;
  inflation_pct?: number | null;
  gdp_growth_pct?: number | null;
  gdp_usd_billions?: number | null;
  government_debt_pct_gdp?: number | null;
  unemployment_pct?: number | null;
  current_account_pct_gdp?: number | null;
  source: string;
  cached: boolean;
  retrieved_at?: string | null;
};

export interface CountryContextResponse {
  country_code: string;
  country_name: string;
  imf?: CountryMacroSnapshot | null;
  world_bank?: CountryMacroSnapshot | null;
  trading_economics?: CountryMacroSnapshot | null;
  wikipedia?: {
    country_code: string;
    country_name: string;
    economy_title?: string | null;
    economy_summary?: string | null;
    economy_url?: string | null;
    central_bank_title?: string | null;
    central_bank_summary?: string | null;
    central_bank_url?: string | null;
    source: string;
    cached: boolean;
    fetched_at?: string | null;
  } | null;
}

export const wikipediaAPI = {
  getConfig: () => api.get<WikipediaApiConfig>("/api/admin/wikipedia-api"),
  updateConfig: (data: JsonRecord) => api.put("/api/admin/wikipedia-api", data),
  testConnection: (data?: { country_code?: string }) =>
    api.post("/api/admin/wikipedia-api/test", data ?? {}),
  sync: () => api.post("/api/admin/wikipedia-api/sync"),
  enable: () => api.post("/api/admin/wikipedia-api/enable"),
  disable: () => api.post("/api/admin/wikipedia-api/disable"),
  getHealth: () => api.get<WikipediaApiHealth>("/api/admin/wikipedia-api/health"),
};

export interface WorldBankApiConfig {
  id: string;
  provider_name: string;
  base_url: string;
  api_key_set: boolean;
  refresh_interval: string;
  sync_enabled: boolean;
  is_active: boolean;
  source_config: {
    country_codes?: string[];
    indicators?: string[];
    date_range?: string;
    preferred_year?: number | null;
  };
  last_sync?: string | null;
  sync_status: string;
  countries_synced: number;
  error_count: number;
  success_count: number;
}

export interface WorldBankApiHealth {
  status: string;
  provider: string;
  is_active: boolean;
  sync_status: string;
  last_sync?: string | null;
  next_sync?: string | null;
  countries_synced: number;
  success_rate?: number | null;
  using_cached_data: boolean;
}

export const worldBankAPI = {
  getConfig: () => api.get<WorldBankApiConfig>("/api/admin/world-bank-api"),
  updateConfig: (data: JsonRecord) => api.put("/api/admin/world-bank-api", data),
  testConnection: (data?: { country_code?: string }) =>
    api.post("/api/admin/world-bank-api/test", data ?? {}),
  sync: () => api.post("/api/admin/world-bank-api/sync"),
  enable: () => api.post("/api/admin/world-bank-api/enable"),
  disable: () => api.post("/api/admin/world-bank-api/disable"),
  getHealth: () => api.get<WorldBankApiHealth>("/api/admin/world-bank-api/health"),
  getLogs: (params?: { limit?: number }) =>
    api.get("/api/admin/world-bank-api/logs", { params }),
};

export interface TradingEconomicsApiConfig {
  id: string;
  provider_name: string;
  base_url: string;
  api_key_set: boolean;
  refresh_interval: string;
  sync_enabled: boolean;
  is_active: boolean;
  source_config: {
    country_codes?: string[];
    indicators?: string[];
    preferred_year?: number | null;
  };
  last_sync?: string | null;
  sync_status: string;
  countries_synced: number;
  error_count: number;
  success_count: number;
}

export interface TradingEconomicsApiHealth {
  status: string;
  provider: string;
  is_active: boolean;
  sync_status: string;
  last_sync?: string | null;
  next_sync?: string | null;
  countries_synced: number;
  success_rate?: number | null;
  using_cached_data: boolean;
}

export const tradingEconomicsAPI = {
  getConfig: () => api.get<TradingEconomicsApiConfig>("/api/admin/trading-economics-api"),
  updateConfig: (data: JsonRecord) => api.put("/api/admin/trading-economics-api", data),
  testConnection: (data?: { api_key?: string; country_code?: string }) =>
    api.post("/api/admin/trading-economics-api/test", data ?? {}),
  sync: () => api.post("/api/admin/trading-economics-api/sync"),
  enable: () => api.post("/api/admin/trading-economics-api/enable"),
  disable: () => api.post("/api/admin/trading-economics-api/disable"),
  getHealth: () => api.get<TradingEconomicsApiHealth>("/api/admin/trading-economics-api/health"),
  getLogs: (params?: { limit?: number }) =>
    api.get("/api/admin/trading-economics-api/logs", { params }),
};

export interface PlatformIntegration {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  admin_path: string;
  is_active: boolean;
  health_status: string;
  sync_status: string;
  last_sync: string | null;
  api_key_set: boolean;
  metrics: Record<string, number | null | undefined>;
  supports_sync: boolean;
  supports_background_sync: boolean;
}

export const integrationsAPI = {
  list: () =>
    api.get<{
      total: number;
      active: number;
      healthy: number;
      warning: number;
      offline: number;
      integrations: PlatformIntegration[];
    }>("/api/admin/integrations"),
  sync: (id: string) => api.post(`/api/admin/integrations/${id}/sync`),
};

export const securityAPI = {
  getOverview: () => api.get("/api/admin/security/overview"),
  getLoginHistory: () => api.get("/api/admin/security/login-history"),
  getSessions: () =>
    api.get("/api/admin/security/sessions", {
      headers: { "X-Refresh-Token": getBrowserStorageItem("refresh_token") ?? "" },
    }),
  revokeSession: (id: string) => api.delete(`/api/admin/security/sessions/${id}`),
  revokeOtherSessions: () =>
    api.post(
      "/api/admin/security/sessions/revoke-others",
      {},
      { headers: { "X-Refresh-Token": getBrowserStorageItem("refresh_token") ?? "" } },
    ),
  setupMfa: () => api.post("/api/admin/security/mfa/setup"),
  enableMfa: (code: string) => api.post("/api/admin/security/mfa/enable", { code }),
  disableMfa: (password: string, code: string) =>
    api.post("/api/admin/security/mfa/disable", { password, code }),
  changePassword: (current_password: string, new_password: string) =>
    api.post("/api/admin/security/change-password", { current_password, new_password }),
};

export const apiConfigsAPI = {
  list: () => api.get<ApiConfigRecord[]>("/api/admin/api-configs"),
  create: (data: JsonRecord) => api.post("/api/admin/api-configs", data),
  update: (id: string, data: JsonRecord) =>
    api.put(`/api/admin/api-configs/${id}`, data),
  delete: (id: string) => api.delete(`/api/admin/api-configs/${id}`),
  test: (id: string) => api.post(`/api/admin/api-configs/${id}/test`),
  sync: (id: string) => api.post(`/api/admin/api-configs/${id}/sync`),
  health: () => api.get("/api/admin/api-configs/health"),
  logs: (params?: { api_id?: string; status?: string; limit?: number }) =>
    api.get("/api/admin/api-configs/logs", { params }),
  refreshReports: () => api.post("/api/admin/api-configs/refresh-reports"),
};

export const getNotificationsWebSocketUrl = () => {
  const token = getBrowserStorageItem("access_token");
  if (!token || typeof window === "undefined") return null;
  const wsBase = API_URL.replace(/^http/, "ws");
  return `${wsBase}/ws/notifications?token=${encodeURIComponent(token)}`;
};

export const intelligenceAPI = {
  listEvents: (params?: JsonRecord) =>
    api.get("/api/intelligence/events", { params }),
  getEventTimeline: (countryCode: string, months = 24) =>
    api.get(`/api/intelligence/events/timeline/${countryCode}`, { params: { months } }),
  getExplainability: (predictionId: string) =>
    api.get(`/api/intelligence/explainability/${predictionId}`),
  getMultiHorizon: (countryCode: string) =>
    api.get(`/api/intelligence/multi-horizon/${countryCode}`),
  getAccuracy: (countryCode?: string) =>
    api.get("/api/intelligence/accuracy", { params: countryCode ? { country_code: countryCode } : {} }),
  runScenario: (data: JsonRecord) => api.post("/api/intelligence/scenarios", data),
  listScenarios: () => api.get("/api/intelligence/scenarios"),
  getRisks: (codes?: string) =>
    api.get("/api/intelligence/risk", { params: codes ? { codes } : {} }),
  getCountryRisk: (code: string) => api.get(`/api/intelligence/risk/${code}`),
  getEconomicHealth: (code: string) => api.get(`/api/intelligence/health/${code}`),
  getNews: (params?: JsonRecord) => api.get("/api/intelligence/news", { params }),
  getNewsStatus: () =>
    api.get<{
      live_feed_enabled: boolean;
      provider: string;
      status: string;
      last_sync?: string | null;
      articles_retrieved: number;
      using_cached_data: boolean;
    }>("/api/intelligence/news/status"),
  getCountryContext: (countryCode: string) =>
    api.get<CountryContextResponse>(`/api/intelligence/country-context/${countryCode}`),
  getNewsArticle: (id: string) => api.get(`/api/intelligence/news/${id}`),
  getSentiment: (code: string) => api.get(`/api/intelligence/sentiment/${code}`),
  getAdvancedIndicators: (code: string) =>
    api.get(`/api/intelligence/indicators/${code}`),
  listResearch: (params?: JsonRecord) =>
    api.get("/api/intelligence/research", { params }),
  getResearch: (id: string) => api.get(`/api/intelligence/research/${id}`),
  exportPredictions: (countryCode: string) =>
    api.get(`/api/intelligence/export/predictions/${countryCode}`, { responseType: "blob" }),
  getHub: (countryCode: string) =>
    api.get(`/api/intelligence/hub/${countryCode}`),
  getReliability: (countryCode: string, confidence = 0.75) =>
    api.get(`/api/intelligence/reliability/${countryCode}`, { params: { confidence } }),
  getForecastChanges: (countryCode: string) =>
    api.get(`/api/intelligence/changes/${countryCode}`),
  getRegime: (countryCode: string) =>
    api.get(`/api/intelligence/regime/${countryCode}`),
  getAnomalies: (countryCode: string) =>
    api.get(`/api/intelligence/anomalies/${countryCode}`),
  getEarlyWarnings: (countryCode?: string) =>
    api.get("/api/intelligence/warnings", { params: countryCode ? { country_code: countryCode } : {} }),
  getSimilarCountries: (countryCode: string, limit = 5) =>
    api.get(`/api/intelligence/similarity/${countryCode}`, { params: { limit } }),
  getCpiSelection: (countryCode: string) =>
    api.get(`/api/intelligence/cpi-selection/${countryCode}`),
  getDataSelection: (countryCode: string) =>
    api.get(`/api/intelligence/data-selection/${countryCode}`),
  getInflationMap: (params?: JsonRecord) =>
    api.get("/api/intelligence/inflation-map", { params }),
  getBacktest: (countryCode?: string) =>
    api.get("/api/intelligence/backtest", { params: countryCode ? { country_code: countryCode } : {} }),
  getDataLineage: (predictionId: string) =>
    api.get(`/api/intelligence/lineage/${predictionId}`),
  getForecastArchive: (countryCode: string, limit = 20) =>
    api.get(`/api/intelligence/archive/${countryCode}`, { params: { limit } }),
  getRecommendations: (countryCode: string, params?: JsonRecord) =>
    api.get(`/api/intelligence/recommendations/${countryCode}`, { params }),
  getResilience: (countryCode: string) =>
    api.get(`/api/intelligence/resilience/${countryCode}`),
  getPageInsights: (countryCode: string, page = "overview") =>
    api.get(`/api/intelligence/insights/${countryCode}`, { params: { page } }),
  getNarrative: (countryCode: string) =>
    api.get(`/api/intelligence/narrative/${countryCode}`),
  naturalLanguageQuery: (data: JsonRecord) =>
    api.post("/api/intelligence/nlq", data),
  getExplainabilityPdf: (predictionId: string) =>
    api.get(`/api/intelligence/explainability-pdf/${predictionId}`, { responseType: "blob" }),
  getModelVersions: () => api.get("/api/intelligence/models/versions"),
  rollbackModel: (modelId: string) =>
    api.post(`/api/intelligence/models/rollback/${modelId}`),
  listExperiments: () => api.get("/api/intelligence/experiments"),
  compareExperiments: (experimentIds: string[]) =>
    api.post("/api/intelligence/experiments/compare", { experiment_ids: experimentIds }),
};

export const adminIntelligenceAPI = {
  createEvent: (data: JsonRecord) => api.post("/api/admin/intelligence/events", data),
  updateEvent: (id: string, data: JsonRecord) =>
    api.put(`/api/admin/intelligence/events/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/api/admin/intelligence/events/${id}`),
  importEvents: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/api/admin/intelligence/events/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getSettings: () => api.get("/api/admin/intelligence/settings"),
  updateSettings: (data: JsonRecord) => api.put("/api/admin/intelligence/settings", data),
  getRetraining: () => api.get("/api/admin/intelligence/retraining"),
  qualityCheck: (datasetId: string, autoClean = false) =>
    api.post(`/api/admin/intelligence/datasets/${datasetId}/quality-check`, null, {
      params: { auto_clean: autoClean },
    }),
  createPublication: (data: JsonRecord) =>
    api.post("/api/admin/intelligence/research", data),
};

export const searchAPI = {
  query: (q: string, limit = 5) =>
    api.get<SearchResponse>("/api/search", { params: { q, limit } }),
};

export default api;
