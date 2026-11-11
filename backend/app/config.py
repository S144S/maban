from typing import Literal
from urllib.parse import urlsplit

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
    sms_price_toman: int = Field(default=0, ge=0, le=1000000)
    payment_merchant_id: str = Field(default="", repr=False)
    payment_callback_url: str = ""
    minio_endpoint: str = ""
    minio_access_key: str = Field(default="", repr=False)
    minio_secret_key: str = Field(default="", repr=False)
    minio_bucket: str = Field(default="maban-plants", pattern=r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")
    minio_secure: bool = True

    @model_validator(mode="after")
    def validate_production(self):
        if bool(self.payment_merchant_id) != bool(self.payment_callback_url):
            raise ValueError("Payments require PAYMENT_MERCHANT_ID and PAYMENT_CALLBACK_URL together")
        if self.payment_callback_url:
            callback = urlsplit(self.payment_callback_url)
            if (callback.scheme not in {"http", "https"} or not callback.netloc
                    or callback.path != "/api/wallet/callback" or callback.query or callback.fragment
                    or callback.username or callback.password):
                raise ValueError("PAYMENT_CALLBACK_URL must point to /api/wallet/callback")
            if self.environment == "production" and callback.scheme != "https":
                raise ValueError("Production payments require an HTTPS callback")
            if not self.allowed_origins:
                raise ValueError("Payments require a frontend origin for callback redirects")
        storage = (self.minio_endpoint, self.minio_access_key, self.minio_secret_key)
        if any(storage) and not all(storage):
            raise ValueError("MinIO requires endpoint, access key and secret key together")
        if self.minio_endpoint and ("://" in self.minio_endpoint or "/" in self.minio_endpoint):
            raise ValueError("MINIO_ENDPOINT must be a host with optional port, without scheme or path")
        if self.minio_endpoint and self.environment == "production" and not self.minio_secure:
            raise ValueError("Production MinIO requires TLS")
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
            if not self.sms_price_toman:
                raise ValueError("Reminder SMS requires a positive SMS_PRICE_TOMAN")
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
