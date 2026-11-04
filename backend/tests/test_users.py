from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import UUID

import pytest
from conftest import HEADERS
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select, update

from app.config import Settings
from app.main import create_app
from app.users.models import LoginSession, OtpChallenge, User
from app.users.security import password_matches
from app.users.service import utcnow

PHONE = "09123456789"
PASSWORD = "test-password-123!"


def request(client, purpose="signup", phone=PHONE):
    response = client.post("/api/auth/otp/request", json={"phone": phone, "purpose": purpose})
    assert response.status_code == 200, response.text
    return response.json()["challenge_id"]


def verify(client, challenge, code="12345"):
    return client.post("/api/auth/otp/verify", json={"challenge_id": challenge, "code": code})


def register(client, phone=PHONE):
    challenge = request(client, phone=phone)
    proof = verify(client, challenge).json()["proof"]
    response = client.post(
        "/api/auth/register",
        json={"proof": proof, "first_name": "سعید", "last_name": "آزمایشی", "password": PASSWORD},
    )
    assert response.status_code == 201, response.text
    return response.json()["user"]


def allow_resend(app):
    with app.state.sessions.begin() as db:
        db.execute(update(OtpChallenge).values(created_at=utcnow() - timedelta(seconds=31)))


def login(client, phone=PHONE, password=PASSWORD):
    return client.post("/api/auth/login", json={"phone": phone, "password": password})


def test_registration_persists_and_password_is_hashed(client, app):
    user = register(client, "۰۹۱۲۳۴۵۶۷۸۹")
    assert user["phone"] == PHONE and user["role"] == "user"
    assert "password" not in str(user)
    assert client.get("/api/users/me").json()["user"]["id"] == user["id"]
    with app.state.sessions() as db:
        stored = db.get(User, UUID(user["id"]))
        assert stored.password_hash != PASSWORD and password_matches(stored.password_hash, PASSWORD)
        session = db.scalar(select(LoginSession))
        assert session.token_hash != client.cookies.get("maban_session")
    other = TestClient(app, headers=HEADERS)
    assert login(other).status_code == 200
    assert other.get("/api/users/me").json()["user"]["id"] == user["id"]


def test_unknown_phone_never_creates_session(client, app):
    response = client.post("/api/auth/otp/request", json={"phone": PHONE, "purpose": "login"})
    assert response.status_code == 400
    assert "ثبت‌نام" in response.json()["detail"]
    assert "challenge_id" not in response.json()
    with app.state.sessions() as db:
        assert db.scalar(select(OtpChallenge)) is None
    assert login(client).status_code == 401
    assert client.get("/api/users/me").status_code == 401
    assert not client.cookies.get("maban_session")


def test_otp_login_is_single_use_and_cookie_is_httponly(client, app):
    register(client)
    client.post("/api/auth/logout")
    allow_resend(app)
    challenge = request(client, "login")
    response = verify(client, challenge, "۱۲۳۴۵")
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"] and "SameSite=lax" in response.headers["set-cookie"]
    assert verify(client, challenge).status_code == 400
    client.post("/api/auth/logout")
    assert client.get("/api/users/me").status_code == 401


def test_expiry_and_five_wrong_attempts_survive_errors(client, app):
    challenge = request(client)
    for _ in range(5):
        assert verify(client, challenge, "99999").status_code == 400
    assert verify(client, challenge).status_code == 400
    with app.state.sessions() as db:
        assert db.get(OtpChallenge, UUID(challenge)).attempts == 5
    allow_resend(app)
    fresh = request(client)
    with app.state.sessions.begin() as db:
        db.get(OtpChallenge, UUID(fresh)).expires_at = utcnow() - timedelta(seconds=1)
    assert verify(client, fresh).status_code == 400


def test_cooldown_and_old_code_invalidation(client, app):
    old = request(client)
    response = client.post("/api/auth/otp/request", json={"phone": PHONE, "purpose": "signup"})
    assert response.status_code == 429 and int(response.headers["retry-after"]) > 0
    allow_resend(app)
    new = request(client)
    assert verify(client, old).status_code == 400
    assert verify(client, new).status_code == 200


def test_registration_requires_proof_and_rejects_reuse_and_duplicate(client, app):
    data = {"proof": "x" * 43, "first_name": "سعید", "last_name": "آزمایشی", "password": PASSWORD}
    assert client.post("/api/auth/register", json=data).status_code == 400
    challenge = request(client)
    data["proof"] = verify(client, challenge).json()["proof"]
    assert client.post("/api/auth/register", json=data).status_code == 201
    assert client.post("/api/auth/register", json=data).status_code == 400
    allow_resend(app)
    assert verify(client, request(client)).status_code == 400


def test_proof_expiry_and_purpose_binding(client, app):
    proof = verify(client, request(client)).json()["proof"]
    assert (
        client.post("/api/auth/reset-password", json={"proof": proof, "password": PASSWORD}).status_code
        == 400
    )
    with app.state.sessions.begin() as db:
        db.execute(update(OtpChallenge).values(proof_expires_at=utcnow() - timedelta(seconds=1)))
    assert (
        client.post(
            "/api/auth/register",
            json={"proof": proof, "password": PASSWORD, "first_name": "نام", "last_name": "فامیل"},
        ).status_code
        == 400
    )


def test_concurrent_registration_consumes_proof_once(client, app):
    proof = verify(client, request(client)).json()["proof"]

    def finish(_):
        with TestClient(app, headers=HEADERS) as other:
            return other.post(
                "/api/auth/register",
                json={"proof": proof, "password": PASSWORD, "first_name": "نام", "last_name": "فامیل"},
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(finish, range(2))) == [201, 400]


def test_password_change_revokes_all_sessions(client, app):
    register(client)
    other = TestClient(app, headers=HEADERS)
    assert login(other).status_code == 200
    assert (
        client.post(
            "/api/users/me/password", json={"current_password": "wrong", "password": "new-password"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/users/me/password", json={"current_password": PASSWORD, "password": "new-password"}
        ).status_code
        == 200
    )
    assert other.get("/api/users/me").status_code == 401
    assert client.get("/api/users/me").status_code == 401
    assert login(client).status_code == 401
    assert login(client, password="new-password").status_code == 200


def test_recovery_requires_verified_existing_account(client, app):
    register(client)
    other = TestClient(app, headers=HEADERS)
    assert login(other).status_code == 200
    allow_resend(app)
    proof = verify(client, request(client, "recovery")).json()["proof"]
    assert (
        client.post("/api/auth/reset-password", json={"proof": proof, "password": "new-password"}).status_code
        == 200
    )
    assert other.get("/api/users/me").status_code == 401
    assert login(client, password="new-password").status_code == 200


def test_sessions_are_owned_and_revoke_others(client, app):
    register(client)
    other = TestClient(app, headers=HEADERS)
    login(other)
    foreign = TestClient(app, headers=HEADERS)
    register(foreign, "09123456780")
    session_id = foreign.get("/api/users/me/sessions").json()["sessions"][0]["id"]
    assert client.delete(f"/api/users/me/sessions/{session_id}").status_code == 404
    assert client.delete("/api/users/me/sessions/others").status_code == 200
    assert other.get("/api/users/me").status_code == 401
    assert client.get("/api/users/me").status_code == 200
    assert foreign.get("/api/users/me").status_code == 200


def test_profile_validation_and_role_escalation_rejected(client):
    register(client)
    assert (
        client.patch(
            "/api/users/me", json={"first_name": "نام", "last_name": "تازه", "role": "admin"}
        ).status_code
        == 422
    )
    assert client.patch("/api/users/me", json={"first_name": "  ", "last_name": "تازه"}).status_code == 422
    result = client.patch("/api/users/me", json={"first_name": "نام", "last_name": "تازه"})
    assert result.json()["user"]["last_name"] == "تازه"
    assert client.get("/api/admin/users").status_code == 403


def test_admin_can_suspend_and_reactivate_but_not_itself(client, app):
    admin = register(client)
    with app.state.sessions.begin() as db:
        db.get(User, UUID(admin["id"])).role = "admin"
    other = TestClient(app, headers=HEADERS)
    target = register(other, "09123456780")
    assert client.get("/api/admin/users").json()["total"] == 2
    assert (
        client.patch(f"/api/admin/users/{admin['id']}", json={"active": False, "role": "user"}).status_code
        == 400
    )
    path = f"/api/admin/users/{target['id']}"
    assert client.patch(path, json={"active": False, "role": "user"}).status_code == 200
    assert other.get("/api/users/me").status_code == 401
    assert login(other, "09123456780").status_code == 401
    allow_resend(app)
    response = other.post("/api/auth/otp/request", json={"phone": "09123456780", "purpose": "login"})
    assert response.status_code == 400
    assert "challenge_id" not in response.json()
    assert client.patch(path, json={"active": True, "role": "user"}).status_code == 200
    assert login(other, "09123456780").status_code == 200


def test_csrf_invalid_types_and_no_password_echo(client):
    assert (
        client.post("/api/auth/login", json={}, headers={"Origin": "https://evil.example"}).status_code == 403
    )
    assert client.post("/api/auth/logout", headers={"X-Maban-Request": ""}).status_code == 403
    for value in [None, 12, {}, []]:
        response = client.post("/api/auth/login", json={"phone": value, "password": "secret-value"})
        assert response.status_code == 422
        assert "secret-value" not in response.text


def test_password_rate_limit_and_session_expiry(client, app):
    register(client)
    with app.state.sessions.begin() as db:
        db.execute(update(LoginSession).values(expires_at=utcnow() - timedelta(seconds=1)))
    assert client.get("/api/users/me").status_code == 401
    for _ in range(10):
        assert login(client, password="wrong").status_code == 401
    assert login(client).status_code == 429


def test_production_never_accepts_fixed_development_code(app, monkeypatch):
    settings = app.state.settings.model_dump()
    settings.update(
        environment="production",
        cookie_secure=True,
        allowed_origins=["https://maban.example"],
        sms_api_key="test-provider-key",
        sms_template="test-template",
    )

    class Sms:
        code = None

        def send(self, phone, code):
            self.code = code

    sms = Sms()
    monkeypatch.setattr("app.users.service.secrets.randbelow", lambda _: 54321)
    production = create_app(Settings(**settings), sms=sms)
    with TestClient(
        production,
        base_url="https://maban.example",
        headers={"Origin": "https://maban.example", "X-Maban-Request": "1"},
    ) as client:
        challenge = request(client)
        assert sms.code == "54321"
        assert verify(client, challenge).status_code == 400
        proof = verify(client, challenge, "54321").json()["proof"]
        response = client.post(
            "/api/auth/register",
            json={"proof": proof, "password": PASSWORD, "first_name": "نام", "last_name": "فامیل"},
        )
        assert response.status_code == 201 and "Secure" in response.headers["set-cookie"]
    with pytest.raises(ValidationError):
        Settings(**{**settings, "cookie_secure": False})


def test_sms_failure_does_not_issue_usable_challenge(client, app):
    class FailedSms:
        def send(self, phone, code):
            raise RuntimeError("secret provider URL")

    app.state.sms = FailedSms()
    response = client.post("/api/auth/otp/request", json={"phone": PHONE, "purpose": "signup"})
    assert response.status_code == 503 and "secret provider" not in response.text
    with app.state.sessions() as db:
        assert db.scalar(select(OtpChallenge)) is None


def test_session_survives_application_restart(client, app):
    user = register(client)
    restarted = create_app(app.state.settings)
    with TestClient(restarted, headers=HEADERS) as other:
        other.cookies.update(client.cookies)
        assert other.get("/api/users/me").json()["user"]["id"] == user["id"]


def test_concurrent_otp_login_only_creates_one_session(client, app):
    register(client)
    client.post("/api/auth/logout")
    allow_resend(app)
    challenge = request(client, "login")

    def finish(_):
        with TestClient(app, headers=HEADERS) as other:
            return verify(other, challenge).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(finish, range(2))) == [200, 400]
    with app.state.sessions() as db:
        assert len(list(db.scalars(select(LoginSession)))) == 1


def test_non_admin_cannot_change_another_user_role(client, app):
    register(client)
    other = TestClient(app, headers=HEADERS)
    target = register(other, "09123456780")
    response = client.patch(f"/api/admin/users/{target['id']}", json={"active": False, "role": "admin"})
    assert response.status_code == 403
    assert other.get("/api/users/me").json()["user"]["role"] == "user"
