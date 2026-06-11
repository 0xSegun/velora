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
  timeout: 30000,
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
    }>("/api/countries", { params: { per_page: 100, ...params } });
    return data;
  },
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

export const dashboardAPI = {
  getOverview: () => api.get<DashboardOverview>("/api/dashboard/overview"),
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
  getSentiment: (code: string) => api.get(`/api/intelligence/sentiment/${code}`),
  getAdvancedIndicators: (code: string) =>
    api.get(`/api/intelligence/indicators/${code}`),
  listResearch: (params?: JsonRecord) =>
    api.get("/api/intelligence/research", { params }),
  getResearch: (id: string) => api.get(`/api/intelligence/research/${id}`),
  exportPredictions: (countryCode: string) =>
    api.get(`/api/intelligence/export/predictions/${countryCode}`, { responseType: "blob" }),
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
