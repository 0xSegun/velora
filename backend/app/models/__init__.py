"""
Database ORM models for Velora.
"""

from app.models.analytics_event import AnalyticsEvent
from app.models.security_audit import SecurityAuditLog
from app.models.user import AuthProvider, User, UserRole
from app.models.user_session import UserSession
from app.models.prediction import Prediction
from app.models.prediction_detail import PredictionDetail
from app.models.country import Country
from app.models.economic_data import EconomicData, DataSource
from app.models.site_settings import SiteSettings, AIModel, Notification, ModelStatus, NotificationType
from app.models.report import Report, ReportType
from app.models.api_config import ApiConfiguration, ApiType, ApiHealthStatus
from app.models.dataset import Dataset
from app.models.model_training import ModelTraining, TrainingStatus
from app.models.system_log import SystemLog, LogLevel
from app.models.exchange_rate import (
    ExchangeRate,
    ExchangeRateApiConfig,
    ExchangeRateApiLog,
    ExchangeRateAuditLog,
    ExchangeRateHistory,
    PeriodType,
    RefreshInterval,
    SyncStatus,
)
from app.models.resend_email import ResendApiLog, ResendAuditLog, ResendEmailConfig
from app.models.fred import (
    FredApiConfig,
    FredApiLog,
    FredAuditLog,
    FredEconomicData,
    FredIndicator,
    FredSyncStatus,
)
from app.models.news_api import NewsApiConfig, NewsApiLog, NewsProvider, NewsSyncStatus
from app.models.imf_api import ImfApiConfig, ImfApiLog, ImfCountryData, ImfSyncStatus
from app.models.world_bank_api import (
    WorldBankApiConfig,
    WorldBankApiLog,
    WorldBankCountryData,
    WorldBankSyncStatus,
)
from app.models.trading_economics_api import (
    TradingEconomicsApiConfig,
    TradingEconomicsApiLog,
    TradingEconomicsCountryData,
    TradingEconomicsSyncStatus,
)
from app.models.wikipedia_api import (
    WikipediaApiConfig,
    WikipediaCountryCache,
    WikipediaSyncStatus,
)
from app.models.intelligence import (
    BacktestSession,
    CountryRiskScore,
    DataQualityReport,
    EconomicEvent,
    EconomicNews,
    ForecastArchive,
    ForecastScenario,
    IntelligenceAlert,
    IntelligenceSetting,
    ModelExperiment,
    MultiHorizonForecast,
    PredictionAccuracyRecord,
    ResearchPublication,
    RetrainingRecommendation,
    SentimentRecord,
)

__all__ = [
    "AnalyticsEvent",
    "AuthProvider",
    "User",
    "UserRole",
    "UserSession",
    "Prediction",
    "PredictionDetail",
    "Country",
    "EconomicData",
    "DataSource",
    "SiteSettings",
    "AIModel",
    "Notification",
    "ModelStatus",
    "NotificationType",
    "Report",
    "ReportType",
    "ApiConfiguration",
    "ApiType",
    "ApiHealthStatus",
    "ExchangeRate",
    "ExchangeRateApiConfig",
    "ExchangeRateApiLog",
    "ExchangeRateAuditLog",
    "ExchangeRateHistory",
    "RefreshInterval",
    "SyncStatus",
    "PeriodType",
    "ResendEmailConfig",
    "ResendApiLog",
    "ResendAuditLog",
    "Dataset",
    "ModelTraining",
    "TrainingStatus",
    "SystemLog",
    "LogLevel",
    "EconomicEvent",
    "MultiHorizonForecast",
    "PredictionAccuracyRecord",
    "CountryRiskScore",
    "EconomicNews",
    "SentimentRecord",
    "ResearchPublication",
    "DataQualityReport",
    "ForecastScenario",
    "IntelligenceSetting",
    "RetrainingRecommendation",
    "ForecastArchive",
    "IntelligenceAlert",
    "ModelExperiment",
    "BacktestSession",
    "FredApiConfig",
    "FredApiLog",
    "FredAuditLog",
    "FredEconomicData",
    "FredIndicator",
    "FredSyncStatus",
    "NewsApiConfig",
    "NewsApiLog",
    "NewsProvider",
    "NewsSyncStatus",
    "ImfApiConfig",
    "ImfApiLog",
    "ImfCountryData",
    "ImfSyncStatus",
    "WorldBankApiConfig",
    "WorldBankApiLog",
    "WorldBankCountryData",
    "WorldBankSyncStatus",
    "TradingEconomicsApiConfig",
    "TradingEconomicsApiLog",
    "TradingEconomicsCountryData",
    "TradingEconomicsSyncStatus",
    "WikipediaApiConfig",
    "WikipediaCountryCache",
    "WikipediaSyncStatus",
]