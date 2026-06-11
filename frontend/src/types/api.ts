export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  institution?: string;
  country: string;
  role: 'user' | 'admin' | 'analyst';
  avatar_url?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  institution?: string;
  country?: string;
}
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}
export interface TokenPair { access_token: string; refresh_token: string; }

export interface Prediction {
  id: string;
  user_id: string;
  country_code: string;
  inflation_rate: number;
  deflation_probability: number;
  trend_direction: 'up' | 'down' | 'stable';
  confidence_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  input_params: Record<string, any>;
  output_data: Record<string, any>;
  prediction_date: string;
  target_date: string;
  created_at: string;
}
export interface PredictionRequest {
  country_code: string;
  input_data: Record<string, number>;
  forecast_horizon: number;
}

export interface EconomicData {
  id: string;
  country_code: string;
  country_name: string;
  cpi: number;
  gdp: number;
  gdp_growth: number;
  interest_rate: number;
  exchange_rate: number;
  oil_price: number;
  gov_spending: number;
  employment_rate: number;
  unemployment_rate: number;
  inflation_rate: number;
  money_supply: number;
  trade_balance: number;
  data_date: string;
  source: string;
}

export interface SiteSettings {
  key: string;
  value: any;
  category: string;
}

export interface AdminDashboard {
  total_users: number;
  total_predictions: number;
  active_models: number;
  system_health: number;
  recent_activity: any[];
}

export interface ApiResponse<T> { data: T; message?: string; }
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}
