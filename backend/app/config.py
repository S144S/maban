from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MABAN_", env_file=".env", extra="ignore")
    environment: Literal["local", "develop", "test", "production"] = "production"
    database_url: str
    secret_key: str
    allowed_origins: list[str] = ["http://127.0.0.1:6201", "http://localhost:6201"]
    cookie_secure: bool = False
    session_seconds: int = 60 * 60 * 24 * 7
    sms_api_key: str = Field(default="", repr=False)
    sms_template: str = ""
    sms_line_number: str = ""
    sms_reminder_template: str = ""
    reminder_sms_enabled: bool = False

    @model_validator(mode="after")
    def validate_production(self):
        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("PostgreSQL with psycopg is required")
        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must contain at least 32 characters")
        if self.environment == "production":
            if not self.cookie_secure or any(not o.startswith("https://") for o in self.allowed_origins):
                raise ValueError("Production requires secure cookies and HTTPS origins")
            if self.secret_key.startswith("local-only") or not self.sms_api_key.strip() or not self.sms_template.strip():
                raise ValueError("Production requires a private secret and configured SMS provider")
            if not (
                self.sms_line_number.isascii() and self.sms_line_number.isdigit()
            ):
                raise ValueError("IranPayamak requires an ASCII numeric SMS_LINE_NUMBER")
        if self.reminder_sms_enabled:
            if self.environment != "production":
                raise ValueError("Reminder SMS is restricted to production")
            if not self.sms_reminder_template.strip():
                raise ValueError("Reminder SMS requires SMS_REMINDER_TEMPLATE")
            if self.sms_reminder_template == self.sms_template:
                raise ValueError("OTP and reminder patterns must be distinct")
        return self

    @property
    def development_otp(self) -> bool:
        return self.environment in {"local", "develop", "test"}
