from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "智策 AI API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    secret_key: str = "development-only-change-me"
    access_token_minutes: int = 30
    refresh_token_days: int = 30
    verification_token_minutes: int = 15
    require_email_verification: bool = True
    expose_verification_token: bool = False
    rate_limit_enabled: bool = True
    auth_rate_limit_per_minute: int = 20
    market_rate_limit_per_minute: int = 120
    database_url: str = "mysql+asyncmy://zhice:zhice@localhost:3306/zhice_ai"
    redis_url: str = "redis://localhost:6379/0"
    market_data_provider: str = "demo"
    ai_provider: str = "rule_based"
    recommendation_quote_max_age_seconds: int = 1800
    openai_compat_base_url: str = ""
    openai_compat_api_key: str = ""
    openai_compat_model: str = ""
    enable_scheduler: bool = False
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"]
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
