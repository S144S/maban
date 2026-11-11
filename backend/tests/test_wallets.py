from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from test_users import register

from app.users.models import User
from app.wallets.errors import WalletError
from app.wallets.models import Entry, Topup, Wallet
from app.wallets.payments import Zarinpal
from app.wallets.service import Wallets, locked_wallet, record, reserve_sms, settle_sms


class Gateway:
    def __init__(self):
        self.requests, self.verifications = [], []
        self.fail = False

    def request(self, amount):
        self.requests.append(amount)
        return "A" + uuid4().hex + "000"

    def checkout_url(self, authority):
        return "https://www.zarinpal.com/pg/StartPay/" + authority

    def verify(self, authority, amount):
        self.verifications.append((authority, amount))
        if self.fail:
            raise WalletError("پرداخت تأیید نشده.", 409)
        return str(int(authority[1:33], 16))


@pytest.fixture
def gateway(app):
    app.state.payment_gateway = Gateway()
    return app.state.payment_gateway


def fund(app, amount=10000):
    """Test-only seed for delivery tests; production has no manual credit endpoint."""
    with app.state.sessions.begin() as db:
        user = db.scalar(select(User))
        wallet = locked_wallet(db, user.id)
        record(db, wallet, "topup", uuid4(), amount)


def charge(client, amount=50000, request_id=None):
    return client.post("/api/wallet/topups", json={"request_id": request_id or str(uuid4()), "amount_toman": amount})


def test_empty_wallet_is_private_and_not_family_funds(client):
    assert client.get("/api/wallet").status_code == 401
    register(client)
    assert client.get("/api/wallet").json() == {"balance_toman": 0, "sms_price_toman": 0, "topup_enabled": False}
    assert client.get("/api/wallet/entries").json() == {"entries": [], "has_more": False}
    assert charge(client).status_code == 503
    assert client.post("/api/wallet/withdraw", json={"amount_toman": 1}).status_code == 404


@pytest.mark.parametrize("amount", [-1, 0, 9999, 10000001, 10000.5, True, "50000"])
def test_invalid_amounts_rejected(client, gateway, amount):
    register(client)
    assert charge(client, amount).status_code == 422
    assert gateway.requests == []


def test_topup_retries_and_verification_are_idempotent(client, app, gateway):
    register(client)
    key = str(uuid4())
    created = charge(client, request_id=key)
    assert created.status_code == 201
    row = created.json()
    assert charge(client, request_id=key).json()["id"] == row["id"]
    assert len(gateway.requests) == 1
    assert charge(client, amount=60000, request_id=key).status_code == 409
    assert client.get("/api/wallet").json()["balance_toman"] == 0
    gateway.fail = True
    assert client.post(f"/api/wallet/topups/{row['id']}/verify").status_code == 409
    assert client.get("/api/wallet").json()["balance_toman"] == 0
    gateway.fail = False
    assert client.post(f"/api/wallet/topups/{row['id']}/verify").json()["status"] == "paid"
    assert client.post(f"/api/wallet/topups/{row['id']}/verify").status_code == 200
    assert client.get("/api/wallet").json()["balance_toman"] == 50000
    assert len(client.get("/api/wallet/entries").json()["entries"]) == 1


def test_other_users_cannot_read_or_verify_payment(client, app, gateway):
    register(client)
    row = charge(client).json()
    from conftest import HEADERS
    with TestClient(app, headers=HEADERS) as other:
        register(other, "09123456780")
        assert other.get("/api/wallet").json()["balance_toman"] == 0
        assert other.get("/api/wallet/topups").json()["topups"] == []
        assert other.post(f"/api/wallet/topups/{row['id']}/verify").status_code == 404
    assert gateway.verifications == []


def test_callback_requires_remote_verification_and_is_replay_safe(client, app, gateway):
    register(client)
    row = charge(client).json()
    with app.state.sessions() as db:
        authority = db.get(Topup, UUID(row["id"])).authority
    gateway.fail = True
    url = f"/api/wallet/callback?Authority={authority}&Status=OK"
    assert client.get(url, follow_redirects=False).headers["location"].endswith("payment=unconfirmed")
    assert client.get("/api/wallet").json()["balance_toman"] == 0
    assert client.get(url.replace("Status=OK", "Status=NOK"), follow_redirects=False).status_code == 303
    gateway.fail = False
    with TestClient(app) as anonymous:
        assert anonymous.get(url, follow_redirects=False).headers["location"].endswith("payment=confirmed")
        assert anonymous.get(url, follow_redirects=False).status_code == 303
    assert client.get("/api/wallet").json()["balance_toman"] == 50000
    assert gateway.verifications[-1] == (authority, 50000)


def test_parallel_verification_credits_once(client, app, gateway):
    user = register(client)
    row = charge(client).json()
    def verify(_):
        with app.state.sessions.begin() as db:
            return Wallets(db, app.state.settings, gateway).verify(user_id=UUID(user["id"]), topup_id=UUID(row["id"]))
    with ThreadPoolExecutor(max_workers=3) as pool:
        assert all(r["status"] == "paid" for r in pool.map(verify, range(3)))
    assert len(gateway.verifications) == 1
    assert client.get("/api/wallet").json()["balance_toman"] == 50000


def test_parallel_spending_never_overdraws_and_refund_once(client, app):
    user = register(client)
    fund(app, 200)
    ids = [uuid4(), uuid4()]
    def spend(ref):
        with app.state.sessions.begin() as db:
            return reserve_sms(db, UUID(user["id"]), ref, 200)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(spend, ids))
    assert sum(results) == 1
    ref = ids[results.index(True)]
    assert spend(ref)  # Same occurrence is not debited again.
    with app.state.sessions.begin() as db:
        settle_sms(db, ref, "unknown")
        settle_sms(db, ref, "accepted")
    assert client.get("/api/wallet").json()["balance_toman"] == 0
    with app.state.sessions.begin() as db:
        settle_sms(db, ref, "failed")
        settle_sms(db, ref, "failed")
        assert not reserve_sms(db, UUID(user["id"]), ref, 200)
    assert client.get("/api/wallet").json()["balance_toman"] == 200
    with app.state.sessions() as db:
        assert db.scalar(select(func.sum(Entry.amount_toman))) == db.scalar(select(Wallet.balance_toman))


def test_empty_balance_skips_reminder_without_send(client, app):
    from test_reminder_sms import NOW, Sender, enabled
    from test_reminders import payload

    from app.sms_worker import run_batch
    register(client)
    assert client.post("/api/reminders", json=payload(due_at=NOW.isoformat())).status_code == 201
    sender = Sender()
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 0
    assert sender.calls == []
    assert client.get("/api/wallet/entries").json()["entries"] == []
    assert client.get("/api/reminders").json()["reminders"][0]["delivery_status"] == "skipped"


@pytest.mark.parametrize("failure,expected", [("accepted", 9800), ("rejected", 10000), ("unknown", 9800)])
def test_sms_billing_follows_delivery_result(client, app, failure, expected):
    from test_reminder_sms import NOW, Sender, enabled
    from test_reminders import payload

    from app.sms import SmsRejected
    from app.sms_worker import run_batch
    register(client)
    fund(app)
    assert client.post("/api/reminders", json=payload(due_at=NOW.isoformat())).status_code == 201
    sender = Sender(fail=failure == "unknown")
    if failure == "rejected":
        def reject(*args):
            raise SmsRejected("rejected")
        sender.send_pattern = reject
    run_batch(app.state.sessions, enabled(), sender, now=NOW)
    assert client.get("/api/wallet").json()["balance_toman"] == expected
    run_batch(app.state.sessions, enabled(), sender, now=NOW + timedelta(minutes=3))
    assert client.get("/api/wallet").json()["balance_toman"] == expected


def test_zarinpal_converts_tomans_and_handles_already_verified(monkeypatch, app):
    config = app.state.settings.model_copy(update={"payment_merchant_id": "merchant",
        "payment_callback_url": "https://api.example/api/wallet/callback"})
    requests = []
    authority = "A" * 36
    def handler(request):
        import json
        data = json.loads(request.content)
        requests.append(data)
        assert data["amount"] == 500000
        assert data["merchant_id"] == "merchant"
        if request.url.path.endswith("request.json"):
            return httpx.Response(200, json={"data": {"code": 100, "authority": authority}})
        return httpx.Response(200, json={"data": {"code": 101, "ref_id": 12345}})
    real = httpx.Client
    monkeypatch.setattr("app.wallets.payments.httpx.Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    gateway = Zarinpal(config)
    assert gateway.request(50000) == authority
    assert gateway.verify(authority, 50000) == "12345"
    assert len(requests) == 2


@pytest.mark.parametrize("response", [
    httpx.Response(302, headers={"Location": "https://untrusted.example"}),
    httpx.Response(500, text="private-provider-secret"),
    httpx.Response(200, json=[]),
    httpx.Response(200, json={"data": []}),
    httpx.Response(200, json={"data": {"code": 100, "ref_id": None}}),
    httpx.Response(200, content=b" " * 65537),
    httpx.Response(200, content=b"invalid json"),
])
def test_gateway_failures_never_confirm_or_expose_provider_details(monkeypatch, response):
    from test_sms import settings
    calls = []
    def handler(request):
        calls.append(request)
        return response
    real = httpx.Client
    monkeypatch.setattr("app.wallets.payments.httpx.Client", lambda **kw: real(
        transport=httpx.MockTransport(handler), **kw))
    gateway = Zarinpal(settings(payment_merchant_id="merchant",
                               payment_callback_url="https://api.example/api/wallet/callback"))
    with pytest.raises(WalletError) as error:
        gateway.verify("A" * 36, 50000)
    assert "private-provider-secret" not in error.value.message
    assert len(calls) == 1


def test_pending_requests_are_limited_and_paginated(client, gateway):
    register(client)
    for _ in range(5):
        assert charge(client).status_code == 201
    assert charge(client).status_code == 429
    rows = client.get("/api/wallet/topups").json()
    assert len(rows["topups"]) == 5 and not rows["has_more"]
    assert client.get("/api/wallet/topups?offset=5").json()["topups"] == []
    assert client.get("/api/wallet/entries?offset=-1").status_code == 422


def test_cancelled_and_expired_sms_refund_reserved_price(client, app):
    from test_reminder_sms import NOW, Sender, enabled
    from test_reminders import payload

    from app.reminders.public import schedule_sms
    from app.sms_worker import run_batch
    register(client)
    fund(app)
    reminder = client.post("/api/reminders", json=payload(due_at=NOW.isoformat())).json()["reminder"]
    assert schedule_sms(app.state.sessions, enabled(), NOW)
    assert client.get("/api/wallet").json()["balance_toman"] == 9800
    assert client.delete(f"/api/reminders/{reminder['id']}").status_code == 204
    sender = Sender()
    run_batch(app.state.sessions, enabled().model_copy(update={"sms_price_toman": 500}), sender, now=NOW)
    assert client.get("/api/wallet").json()["balance_toman"] == 10000
    assert sender.calls == []
    client.post("/api/reminders", json=payload(due_at=NOW.isoformat()))
    assert schedule_sms(app.state.sessions, enabled(), NOW)
    run_batch(app.state.sessions, enabled(), sender, now=NOW + timedelta(days=2))
    assert client.get("/api/wallet").json()["balance_toman"] == 10000
    assert sender.calls == []
