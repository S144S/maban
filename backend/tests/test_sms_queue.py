from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Event
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from test_sms import settings
from test_users import PHONE, allow_resend, register

from app.main import create_app
from app.messaging.models import SmsJob
from app.messaging.processing import claim, dispatch
from app.messaging.public import enqueue_sms
from app.reminders.models import Reminder
from app.reminders.public import schedule_sms
from app.sms import SmsDeliveryError, SmsRejected
from app.sms_worker import completed, handlers, run_batch
from app.users.models import OtpChallenge, User
from app.users.service import Users


@pytest.fixture
def production(app):
    application = create_app(settings(database_url=app.state.settings.database_url))
    with TestClient(application, base_url="https://maban.example", headers={
        "Origin": "https://maban.example", "X-Maban-Request": "1",
    }) as client:
        yield client, application


class Sender:
    def __init__(self, error=None):
        self.calls = []
        self.error = error

    def send_pattern(self, phone, pattern, attributes):
        self.calls.append((phone, pattern, attributes))
        if self.error:
            raise self.error


def request(production, purpose="signup"):
    client, _ = production
    response = client.post("/api/auth/otp/request", json={"phone": PHONE, "purpose": purpose})
    assert response.status_code == 200, response.text
    return UUID(response.json()["challenge_id"])


def test_enqueue_is_atomic_with_challenge_and_never_calls_provider(app):
    config = settings(database_url=app.state.settings.database_url)
    with app.state.sessions() as db:
        Users(db, config).request_otp(PHONE, "signup", "test")
        db.flush()
        assert db.scalar(select(SmsJob)).status == "pending"
        db.rollback()
    with app.state.sessions() as db:
        assert db.scalar(select(SmsJob)) is None
        assert db.scalar(select(OtpChallenge)) is None


def test_otp_is_encrypted_and_two_workers_send_once(production, monkeypatch):
    monkeypatch.setattr("app.users.service.secrets.randbelow", lambda _: 54321)
    challenge_id = request(production)
    _, app = production
    with app.state.sessions() as db:
        job = db.scalar(select(SmsJob))
        assert job.reference_id == challenge_id and job.status == "pending"
        assert "54321" not in job.encrypted_payload and PHONE not in job.encrypted_payload
    sender = Sender()
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(lambda _: run_batch(app.state.sessions, app.state.settings, sender), range(2))) == 1
    assert sender.calls == [(PHONE, "otp-pattern", {"code": "54321"})]
    with app.state.sessions() as db:
        job = db.scalar(select(SmsJob))
        assert job.status == "accepted" and job.encrypted_payload is None and job.finished_at


@pytest.mark.parametrize("action", ["expired", "superseded", "verified", "inactive", "exhausted"])
def test_obsolete_otp_never_sent(production, client, app, action):
    if action == "inactive":
        register(client)
        allow_resend(app)
    challenge_id = request(production, "login" if action == "inactive" else "signup")
    _, production_app = production
    with app.state.sessions.begin() as db:
        challenge = db.get(OtpChallenge, challenge_id)
        if action == "expired":
            challenge.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        elif action == "superseded":
            challenge.created_at -= timedelta(seconds=31)
        elif action == "verified":
            challenge.consumed = True
        elif action == "exhausted":
            challenge.attempts = 5
        else:
            db.execute(update(User).values(active=False))
    if action == "superseded":
        request(production)
    sender = Sender()
    run_batch(app.state.sessions, production_app.state.settings, sender)
    assert len(sender.calls) == (1 if action == "superseded" else 0)
    with app.state.sessions() as db:
        job = db.scalar(select(SmsJob).where(SmsJob.reference_id == challenge_id))
        assert job.status == "skipped" and job.encrypted_payload is None


@pytest.mark.parametrize("error,status", [
    (SmsDeliveryError("private provider error"), "unknown"),
    (SmsRejected("private provider rejection"), "failed"),
])
def test_async_failure_does_not_replay_or_leak(production, error, status, caplog):
    request(production)  # API succeeds before the provider is contacted.
    _, app = production
    sender = Sender(error)
    assert run_batch(app.state.sessions, app.state.settings, sender) == 1
    assert run_batch(app.state.sessions, app.state.settings, sender) == 0
    assert len(sender.calls) == 1 and "private provider" not in caplog.text
    with app.state.sessions() as db:
        job = db.scalar(select(SmsJob))
        assert job.status == status and job.encrypted_payload is None


def test_crashed_claim_becomes_unknown_and_cannot_dispatch_late(production):
    request(production)
    _, app = production
    now = datetime.now(UTC)
    job_id = claim(app.state.sessions, ["otp"], now)
    sender = Sender()
    assert run_batch(app.state.sessions, app.state.settings, sender, now=now + timedelta(minutes=3)) == 0
    dispatch(app.state.sessions, job_id, app.state.settings.secret_key,
             handlers(app.state.settings, sender), completed)
    assert sender.calls == []
    with app.state.sessions() as db:
        job = db.get(SmsJob, job_id)
        assert job.status == "unknown" and job.encrypted_payload is None


def test_expired_queued_job_is_scrubbed_without_dispatch(production):
    request(production)
    _, app = production
    sender = Sender()
    assert run_batch(app.state.sessions, app.state.settings, sender,
                     now=datetime.now(UTC) + timedelta(minutes=3)) == 1
    assert sender.calls == []
    with app.state.sessions() as db:
        job = db.scalar(select(SmsJob))
        assert job.status == "skipped" and job.encrypted_payload is None


def test_otp_priority_and_disabled_reminders(production, client, app):
    from test_wallets import family, fund
    user = register(client)
    fund(app)
    allow_resend(app)
    now = datetime.now(UTC)
    config = settings(reminder_sms_enabled=True, sms_reminder_template="reminder-pattern")
    with app.state.sessions.begin() as db:
        db.add(Reminder(id=uuid4(), user_id=UUID(user["id"]), sms_family_id=UUID(family(client)), title="Test", due_at=now,
                        next_sms_at=now, recurrence="none", request_id=uuid4(),
                        request_fingerprint="test", created_at=now))
    assert schedule_sms(app.state.sessions, config, now)
    request(production, "login")
    sender = Sender()
    assert run_batch(app.state.sessions, config, sender, limit=1) == 1
    assert sender.calls[0][1] == "otp-pattern"
    # Turning reminders off must not prevent OTP or consume pending reminders.
    assert run_batch(app.state.sessions, settings(), sender) == 0
    with app.state.sessions() as db:
        assert db.scalar(select(SmsJob).where(SmsJob.kind == "reminder")).status == "pending"
    assert run_batch(app.state.sessions, config, sender) == 1
    assert sender.calls[-1][1] == "reminder-pattern"


def test_unreadable_payload_fails_closed(production):
    request(production)
    _, app = production
    with app.state.sessions.begin() as db:
        db.scalar(select(SmsJob)).encrypted_payload = "corrupted"
    sender = Sender()
    assert run_batch(app.state.sessions, app.state.settings, sender) == 1
    assert sender.calls == []
    with app.state.sessions() as db:
        assert db.scalar(select(SmsJob)).status == "failed"


def test_duplicate_reference_rejected(app):
    from sqlalchemy.exc import IntegrityError

    now, reference = datetime.now(UTC), uuid4()
    with pytest.raises(IntegrityError), app.state.sessions.begin() as db:
        for _ in range(2):
            enqueue_sms(db, kind="otp", reference_id=reference, priority=0,
                        available_at=now, expires_at=now + timedelta(minutes=2), secret_key="test")


def test_crash_after_provider_acceptance_does_not_resend(production):
    request(production)
    _, app = production
    now = datetime.now(UTC)
    job_id = claim(app.state.sessions, ["otp"], now)
    sender = Sender()

    def crash(*args):
        raise RuntimeError("Simulated process death after send, before commit")

    with pytest.raises(RuntimeError, match="Simulated"):
        dispatch(app.state.sessions, job_id, app.state.settings.secret_key,
                 handlers(app.state.settings, sender), crash)
    assert len(sender.calls) == 1
    assert run_batch(app.state.sessions, app.state.settings, sender, now=now + timedelta(minutes=3)) == 0
    assert len(sender.calls) == 1
    with app.state.sessions() as db:
        assert db.get(SmsJob, job_id).status == "unknown"


def test_recovery_skips_locked_inflight_send(production):
    request(production)
    _, app = production
    entered, release = Event(), Event()

    class BlockingSender(Sender):
        def send_pattern(self, *args):
            super().send_pattern(*args)
            entered.set()
            assert release.wait(10), "Test did not release sender"

    sender = BlockingSender()
    with ThreadPoolExecutor(max_workers=1) as pool:
        task = pool.submit(run_batch, app.state.sessions, app.state.settings, sender)
        try:
            assert entered.wait(10), "Worker did not start send"
            assert run_batch(app.state.sessions, app.state.settings, Sender(),
                             now=datetime.now(UTC) + timedelta(minutes=3)) == 0
        finally:
            release.set()
        assert task.result() == 1
    with app.state.sessions() as db:
        assert db.scalar(select(SmsJob)).status == "accepted"
