export interface ForecastPoint {
  month: number;
  date: string;
  predicted_rate: number;
  lower_bound: number;
  upper_bound: number;
}

export interface Prediction {
  id: string;
  country_code: string;
  inflation_rate: number;
  deflation_probability: number;
  trend_direction: string;
  confidence_score: number;
  risk_level: string;
  forecast_data: ForecastPoint[];
  input_params: Record<string, unknown>;
  created_at: string;
  prediction_period?: string | null;
  forecast_horizon?: number | null;
  key_influencing_factors?: string[];
  ai_summary?: string | null;
  recommended_actions?: string[];
  historical_comparison?: Record<string, number>;
  confidence_interval?: Record<string, number>;
  data_sources_used?: string[];
  model_version?: string | null;
  explainability?: Record<string, unknown>;
  multi_horizon?: Record<string, unknown>;
  confidence_bands?: Record<string, number>;
}

export interface PredictionHistory {
  predictions: Prediction[];
  total: number;
  page: number;
  per_page: number;
}