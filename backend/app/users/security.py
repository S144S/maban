import hashlib
import hmac
import secrets
from typing import Protocol

import httpx
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import Settings

password_hasher = PasswordHasher()
dummy_hash = password_hasher.hash(secrets.token_urlsafe(32))


def password_matches(encoded: str, password: str) -> bool:
    try:
        return password_hasher.verify(encoded, password)
    except VerificationError, InvalidHashError:
        return False


def digest(secret: str, value: str) -> str:
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


class SmsSender(Protocol):
    def send(self, phone: str, code: str) -> None: ...


class DevelopmentSms:
    def send(self, phone: str, code: str) -> None:
        # No SMS or credential logging in development; code is documented as 12345.
        pass


class KavenegarSms:
    def __init__(self, settings: Settings):
        self.settings = settings

    def send(self, phone: str, code: str) -> None:
        with httpx.Client(timeout=10) as client:
            response = client.post(
                f"https://api.kavenegar.com/v1/{self.settings.sms_api_key}/verify/lookup.json",
                data={"receptor": phone, "token": code, "template": self.settings.sms_template},
            )
            response.raise_for_status()
            if response.json().get("return", {}).get("status") != 200:
                raise RuntimeError("SMS delivery failed")
