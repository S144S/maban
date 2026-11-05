"""Shared SMS transport; business modules own message content and delivery policy."""

import json
import re
from typing import Protocol

import httpx

from app.config import Settings


class SmsDeliveryError(RuntimeError):
    """Delivery failed or is uncertain; never automatically retry."""


class SmsRejected(SmsDeliveryError):
    """The provider explicitly rejected the request before acceptance."""


class SmsSender(Protocol):
    def send(self, phone: str, code: str) -> None: ...


class PatternSender(Protocol):
    def send_pattern(self, phone: str, pattern: str, attributes: dict[str, str]) -> None: ...


class DevelopmentSms:
    def send(self, phone: str, code: str) -> None:
        # Fixed development codes are documented; never log recipients or codes.
        pass


def _post(url: str, **kwargs) -> dict:
    try:
        # A timeout can occur after acceptance. No retries or redirects.
        with (
            httpx.Client(timeout=8, follow_redirects=False) as client,
            client.stream("POST", url, **kwargs) as response,
        ):
            if 400 <= response.status_code < 500 and response.status_code != 408:
                raise SmsRejected("SMS delivery failed")
            response.raise_for_status()
            body = bytearray()
            for chunk in response.iter_bytes(chunk_size=4096):
                body.extend(chunk)
                if len(body) > 65_536:
                    raise ValueError("Oversized response")
            payload = json.loads(body)
            if not isinstance(payload, dict):
                raise SmsDeliveryError("SMS delivery failed")
            return payload
    except (httpx.HTTPError, ValueError):
        raise SmsDeliveryError("SMS delivery failed") from None


class IranPayamakSms:
    def __init__(self, settings: Settings):
        self.settings = settings

    def send(self, phone: str, code: str) -> None:
        self.send_pattern(phone, self.settings.sms_template, {"code": code})

    def send_pattern(self, phone: str, pattern: str, attributes: dict[str, str]) -> None:
        recipient = "0" + phone[3:] if phone.startswith("+98") else phone
        if not re.fullmatch(r"09[0-9]{9}", recipient) or not pattern.strip():
            raise ValueError("Invalid SMS recipient or pattern")
        payload = _post(
            "https://api.iranpayamak.com/ws/v1/sms/pattern",
            headers={"Api-Key": self.settings.sms_api_key, "Accept": "application/json"},
            json={
                "code": pattern,
                "recipient": recipient,
                "attributes": attributes,
                "line_number": self.settings.sms_line_number,
                "number_format": "english",
            },
        )
        if payload.get("status") in ("error", "failed"):
            raise SmsRejected("SMS delivery failed")
        if payload.get("status") != "success":
            raise SmsDeliveryError("SMS delivery failed")


def create_sms_sender(settings: Settings) -> SmsSender:
    if settings.development_otp:
        return DevelopmentSms()
    return IranPayamakSms(settings)
