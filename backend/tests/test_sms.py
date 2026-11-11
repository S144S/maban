import json

import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.sms import DevelopmentSms, IranPayamakSms, SmsDeliveryError, create_sms_sender


def settings(**overrides):
    return Settings(_env_file=None, **{
        "environment": "production",
        "database_url": "postgresql+psycopg://unused/unused",
        "secret_key": "x" * 40,
        "cookie_secure": True,
        "allowed_origins": ["https://maban.example"],
        "sms_api_key": "private-key",
        "sms_template": "otp-pattern",
        "sms_line_number": "30001234",
        "sms_reminder_body": "یادآوری: {title}، {date} ساعت {time}، {amount} تومان",
        **overrides,
    })


def mock_http(monkeypatch, handler):
    client = httpx.Client
    monkeypatch.setattr("app.sms.httpx.Client", lambda **kw: client(
        transport=httpx.MockTransport(handler), **kw,
    ))


@pytest.mark.parametrize("phone", ["09123456789", "+989123456789"])
def test_pattern_request(monkeypatch, phone):
    requests = []

    def handler(request):
        requests.append(request)
        assert str(request.url) == "https://api.iranpayamak.com/ws/v1/sms/pattern"
        assert request.headers["Api-Key"] == "private-key"
        assert json.loads(request.content) == {
            "code": "otp-pattern", "recipient": "09123456789", "attributes": {"code": "01234"},
            "line_number": "30001234", "number_format": "english",
        }
        assert request.extensions["timeout"]["read"] == 8
        return httpx.Response(200, json={"status": "success"})

    mock_http(monkeypatch, handler)
    create_sms_sender(settings()).send(phone, "01234")
    assert len(requests) == 1


@pytest.mark.parametrize("response", [
    httpx.Response(302, headers={"Location": "https://other.example"}),
    httpx.Response(401, text="private-key"),
    httpx.Response(500),
    httpx.Response(200, json={"status": "error", "message": "private-key"}),
    httpx.Response(200, json=[]),
    httpx.Response(200, content=b"not-json"),
    httpx.Response(200, content=b" " * 65_537),
    httpx.Response(200, content=b"\xff"),
])
def test_failures_are_sanitized_without_retry_or_redirect(monkeypatch, response):
    requests = []

    def handler(request):
        requests.append(request)
        return response

    mock_http(monkeypatch, handler)
    with pytest.raises(SmsDeliveryError, match="^SMS delivery failed$"):
        create_sms_sender(settings()).send("09123456789", "01234")
    assert len(requests) == 1


def test_timeout_is_not_retried(monkeypatch):
    requests = []

    def handler(request):
        requests.append(request)
        raise httpx.ReadTimeout("private-key", request=request)

    mock_http(monkeypatch, handler)
    with pytest.raises(SmsDeliveryError, match="^SMS delivery failed$"):
        create_sms_sender(settings()).send("09123456789", "01234")
    assert len(requests) == 1


@pytest.mark.parametrize("environment", ["local", "develop", "test"])
def test_development_does_not_send_or_log(environment, monkeypatch, caplog):
    def handler(request):
        pytest.fail("Development must not contact provider")

    mock_http(monkeypatch, handler)
    sender = create_sms_sender(settings(environment=environment))
    assert isinstance(sender, DevelopmentSms)
    sender.send("09123456789", "12345")
    assert not caplog.records


@pytest.mark.parametrize("overrides", [
    {"sms_api_key": " "}, {"sms_template": " "}, {"sms_line_number": ""},
    {"sms_line_number": "۳۰۰۰"}, {"sms_line_number": "+3000"},
])
def test_production_rejects_invalid_configuration(overrides):
    with pytest.raises(ValidationError):
        settings(**overrides)


def test_api_key_not_in_settings_repr():
    assert "private-key" not in repr(settings())


@pytest.mark.parametrize("overrides", [
    {"sms_reminder_template": ""}, {"sms_reminder_template": " "},
    {"sms_reminder_body": ""}, {"sms_reminder_body": " "},
    {"sms_reminder_body": "{unknown}"}, {"sms_reminder_body": "{title!r}"},
    {"sms_reminder_template": "otp-pattern"}, {"environment": "local"},
    {"environment": "develop"}, {"environment": "test"},
])
def test_reminder_delivery_requires_separate_pattern_and_production(overrides):
    with pytest.raises(ValidationError):
        settings(**{"reminder_sms_enabled": True, "sms_reminder_template": "reminder-pattern", **overrides})


def test_generic_pattern_and_invalid_recipient(monkeypatch):
    def handler(request):
        payload = json.loads(request.content)
        assert payload["code"] == "reminder-pattern"
        assert payload["attributes"] == {"title": "یادآوری"}
        return httpx.Response(200, json={"status": "success"})

    mock_http(monkeypatch, handler)
    sender = IranPayamakSms(settings())
    sender.send_pattern("09123456789", "reminder-pattern", {"title": "یادآوری"})
    with pytest.raises(ValueError):
        sender.send("+441234567890", "12345")


@pytest.mark.parametrize("purpose", ["signup", "login", "recovery"])
def test_real_otp_adapter_is_wired_to_auth_flow(client, app, monkeypatch, purpose):
    from fastapi.testclient import TestClient
    from test_users import PHONE, allow_resend, register

    from app.main import create_app

    if purpose != "signup":
        register(client)
        allow_resend(app)
    calls = []

    def handler(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"status": "success"})

    mock_http(monkeypatch, handler)
    monkeypatch.setattr("app.users.service.secrets.randbelow", lambda _: 54321)
    production = create_app(settings(database_url=app.state.settings.database_url))
    with TestClient(production, base_url="https://maban.example", headers={
        "Origin": "https://maban.example", "X-Maban-Request": "1",
    }) as production_client:
        result = production_client.post("/api/auth/otp/request", json={"phone": PHONE, "purpose": purpose})
        assert result.status_code == 200, result.text
        assert not result.json()["development"]
        from app.sms_worker import run_batch

        assert calls == []
        assert run_batch(production.state.sessions, production.state.settings) == 1
        assert len(calls) == 1 and calls[0]["attributes"] == {"code": "54321"}
        assert calls[0]["code"] == "otp-pattern" and calls[0]["recipient"] == PHONE
