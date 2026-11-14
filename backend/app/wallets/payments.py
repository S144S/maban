"""Zarinpal v4 adapter. Amounts cross this boundary in rials, never floats."""

import json
import re
from typing import Protocol

import httpx

from app.wallets.errors import WalletError


class PaymentGateway(Protocol):
    def request(self, amount_toman: int) -> str: ...
    def verify(self, authority: str, amount_toman: int) -> str: ...
    def checkout_url(self, authority: str) -> str: ...


class Zarinpal:
    def __init__(self, settings):
        self.settings = settings

    def _post(self, method, payload):
        if not self.settings.payment_merchant_id or not self.settings.payment_callback_url:
            raise WalletError("شارژ آنلاین هنوز فعال نشده؛ کمی بعد دوباره امتحان کنین.", 503)
        try:
            with (
                httpx.Client(timeout=8, follow_redirects=False) as client,
                client.stream("POST", f"https://payment.zarinpal.com/pg/v4/payment/{method}.json",
                              json={"merchant_id": self.settings.payment_merchant_id, **payload}) as response,
            ):
                response.raise_for_status()
                body = bytearray()
                for chunk in response.iter_bytes(chunk_size=4096):
                    body.extend(chunk)
                    if len(body) > 65536:
                        raise ValueError("Oversized payment response")
                data = json.loads(body).get("data")
                if not isinstance(data, dict):
                    raise TypeError("Invalid payment response")
                return data
        except (httpx.HTTPError, ValueError, AttributeError, TypeError):
            raise WalletError("ارتباط با درگاه کامل نشد؛ وضعیت پرداخت رو دوباره بررسی کنین.", 502) from None

    def request(self, amount_toman):
        data = self._post("request", {"amount": amount_toman * 10, "currency": "IRR",
                                      "callback_url": self.settings.payment_callback_url,
                                      "description": "شارژ کیف پول مابان"})
        authority = data.get("authority")
        if data.get("code") != 100 or not isinstance(authority, str) or not re.fullmatch(r"[A-Za-z0-9]{36}", authority):
            raise WalletError("درگاه درخواست شارژ رو نپذیرفت؛ دوباره امتحان کنین.", 502)
        return authority

    def verify(self, authority, amount_toman):
        data = self._post("verify", {"amount": amount_toman * 10, "authority": authority})
        reference = data.get("ref_id")
        if data.get("code") not in (100, 101) or not re.fullmatch(r"[0-9]{1,64}", str(reference)):
            raise WalletError("پرداخت هنوز تأیید نشده؛ اگه مبلغ کم شده، وضعیت رو دوباره بررسی کنین.", 409)
        return str(reference)

    def checkout_url(self, authority):
        return f"https://www.zarinpal.com/pg/StartPay/{authority}"
