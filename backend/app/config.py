from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MABAN_", env_file=".env", extra="ignore")
    environment: Literal["local", "develop", "test", "production"] = "production"
    database_url: str
    secret_key: str
    allowed_origins: list[str] = ["http://127.0.0.1:6201", "http://localhost:6201"]
    cookie_secure: bool = False
    session_seconds: int = 60 * 60 * 24 * 7
    sms_api_key: str = ""
    sms_template: str = ""

    @model_validator(mode="after")
    def validate_production(self):
        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("PostgreSQL with psycopg is required")
        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must contain at least 32 characters")
        if self.environment == "production":
            if not self.cookie_secure or any(not o.startswith("https://") for o in self.allowed_origins):
                raise ValueError("Production requires secure cookies and HTTPS origins")
            if self.secret_key.startswith("local-only") or not self.sms_api_key or not self.sms_template:
                raise ValueError("Production requires a private secret and configured SMS provider")
        return self

    @property
    def development_otp(self) -> bool:
        return self.environment in {"local", "develop", "test"}
