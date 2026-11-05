from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jdatetime
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select, update
from test_reminders import payload
from test_sms import settings
from test_users import PHONE, register

from app.messaging.models import SmsJob
from app.messaging.processing import claim, dispatch
from app.reminders.models import Reminder, SmsAttempt
from app.reminders.public import schedule_sms
from app.reminders.scheduling import TEHRAN, occurrence_window
from app.sms import SmsDeliveryError
from app.sms_worker import completed, handlers, run_batch
from app.users.models import User

NOW = datetime(2030, 3, 21, 5, 30, tzinfo=UTC)


class Sender:
    def __init__(self, fail=False):
        self.calls = []
        self.fail = fail

    def send_pattern(self, phone, pattern, attributes):
        self.calls.append((phone, pattern, attributes))
        if self.fail:
            raise SmsDeliveryError("private provider details")


def enabled():
    return settings(reminder_sms_enabled=True, sms_reminder_template="reminder-pattern")


def create(client, **changes):
    response = client.post("/api/reminders", json=payload(due_at=NOW.isoformat(), **changes))
    assert response.status_code == 201, response.text
    return response.json()["reminder"]


def test_due_reminder_sent_once_to_owner(client, app):
    register(client)
    row = create(client)
    sender = Sender()
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW - timedelta(seconds=1)) == 0
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 1
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 0
    phone, pattern, attributes = sender.calls[0]
    assert phone == PHONE and pattern == "reminder-pattern"
    assert attributes == {"title": "قسط وام", "date": "1409/01/01", "time": "09:00", "amount": "2500000"}
    with app.state.sessions() as db:
        reminder = db.get(Reminder, UUID(row["id"]))
        assert reminder.sms_status == "accepted" and reminder.next_sms_at is None
        assert db.scalar(select(SmsAttempt)).status == "accepted"
    result = client.get("/api/reminders").json()["reminders"][0]
    assert result["delivery_status"] == "accepted"


def test_workers_cannot_send_same_occurrence(client, app):
    register(client)
    create(client)
    sender = Sender()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: run_batch(app.state.sessions, enabled(), sender, now=NOW), range(2)))
    assert sum(results) == 1 and len(sender.calls) == 1


def test_timeout_or_crash_never_replays_reserved_occurrence(client, app, caplog):
    register(client)
    create(client)
    sender = Sender(fail=True)
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 1
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 0
    assert "private provider" not in caplog.text and PHONE not in caplog.text
    assert client.get("/api/reminders").json()["reminders"][0]["delivery_status"] == "unknown"
    create(client, title="Crash test")
    assert schedule_sms(app.state.sessions, enabled(), NOW)
    assert claim(app.state.sessions, ["reminder"], NOW) is not None  # Process death before dispatch.
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 0
    assert len(sender.calls) == 1


@pytest.mark.parametrize("action", ["delete", "reschedule", "deactivate"])
def test_cancel_or_inactive_account_before_dispatch(client, app, action):
    user = register(client)
    row = create(client)
    assert schedule_sms(app.state.sessions, enabled(), NOW)
    job_id = claim(app.state.sessions, ["reminder"], NOW)
    if action == "delete":
        assert client.delete(f"/api/reminders/{row['id']}").status_code == 204
    elif action == "reschedule":
        assert client.put(f"/api/reminders/{row['id']}", json={
            "title": row["title"], "due_at": (NOW + timedelta(days=1)).isoformat(),
        }).status_code == 200
    else:
        with app.state.sessions.begin() as db:
            db.execute(update(User).where(User.id == UUID(user["id"])).values(active=False))
    sender = Sender()
    dispatch(app.state.sessions, job_id, enabled().secret_key, handlers(enabled(), sender), completed, now=NOW)
    assert sender.calls == []
    with app.state.sessions() as db:
        job = db.get(SmsJob, job_id)
        assert job.status == "skipped"
        assert db.get(SmsAttempt, job.reference_id).status == "skipped"


def test_disabled_does_not_consume_reminders(client, app):
    register(client)
    row = create(client)
    sender = Sender()
    assert run_batch(app.state.sessions, app.state.settings, sender, now=NOW) == 0
    with app.state.sessions() as db:
        assert db.get(Reminder, UUID(row["id"])).next_sms_at == NOW
        assert db.scalar(select(SmsAttempt)) is None
    assert sender.calls == []


def test_recurring_catches_up_only_latest_and_preserves_schedule(client, app):
    register(client)
    row = create(client, recurrence="daily", amount_toman=None)
    sender = Sender()
    now = NOW + timedelta(days=10, minutes=1)
    assert run_batch(app.state.sessions, enabled(), sender, now=now) == 1
    assert len(sender.calls) == 1 and sender.calls[0][2]["amount"] == "بدون مبلغ"
    with app.state.sessions() as db:
        reminder = db.get(Reminder, UUID(row["id"]))
        assert reminder.due_at == NOW and reminder.next_sms_at == NOW + timedelta(days=11)
    # Editing content must not reset the occurrence or resend an accepted SMS.
    assert client.put(f"/api/reminders/{row['id']}", json={
        "title": "Updated title", "due_at": NOW.isoformat(),
    }).status_code == 200
    assert run_batch(app.state.sessions, enabled(), sender, now=now) == 0
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW + timedelta(days=11)) == 1
    assert sender.calls[-1][2]["title"] == "Updated title"


def test_stale_one_time_reminder_is_skipped_and_migration_guarded(client, app):
    register(client)
    row = create(client)
    sender = Sender()
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW + timedelta(days=2)) == 1
    assert sender.calls == []
    assert client.get("/api/reminders").json()["reminders"][0]["delivery_status"] == "skipped"
    with pytest.raises(RuntimeError, match="Export and explicitly clear"):
        command.downgrade(Config("alembic.ini"), "ef032198c4d5")
    with app.state.sessions() as db:
        assert db.get(Reminder, UUID(row["id"])) is not None


def persian(year, month, day):
    date = jdatetime.date(year, month, day).togregorian()
    return datetime(date.year, date.month, date.day, 9, tzinfo=TEHRAN)


def test_monthly_uses_persian_month_and_recovers_original_day():
    anchor = persian(1405, 6, 31)
    due, following = occurrence_window(anchor, "monthly", persian(1405, 7, 30))
    assert due == persian(1405, 7, 30) and following == persian(1405, 8, 30)
    due, following = occurrence_window(anchor, "monthly", persian(1405, 12, 29))
    assert due == persian(1405, 12, 29) and following == persian(1406, 1, 31)
    due, following = occurrence_window(persian(1403, 11, 30), "monthly", persian(1403, 12, 30))
    assert due == persian(1403, 12, 30) and following == persian(1404, 1, 30)


@pytest.mark.parametrize("recurrence,days", [("daily", 1), ("weekly", 7)])
def test_recurrence_retains_tehran_hour(recurrence, days):
    due, following = occurrence_window(NOW, recurrence, NOW + timedelta(days=days, seconds=-1))
    assert due == NOW and following == NOW + timedelta(days=days)
