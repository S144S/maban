"""Reminder-owned scheduling and delivery policies."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.families.public import is_member
from app.messaging.public import enqueue_sms
from app.reminders.models import Reminder, SmsAttempt
from app.reminders.scheduling import occurrence_window, pattern_attributes
from app.sms_parts import render_pattern
from app.users.public import notification_phone
from app.wallets.public import message_price, reserve_sms, settle_sms, sms_reserved

MAX_LATENESS = timedelta(hours=24)


def schedule_one(sessions, settings, now):
    if not settings.reminder_sms_enabled or settings.development_otp:
        return False
    with sessions.begin() as db:
        row = db.scalar(select(Reminder).where(
            Reminder.deleted_at.is_(None), Reminder.next_sms_at <= now,
        ).order_by(Reminder.next_sms_at, Reminder.id).limit(1).with_for_update(skip_locked=True))
        if row is None:
            return False
        due, following = occurrence_window(row.due_at, row.recurrence, now)
        row.next_sms_at, row.sms_status = following, "pending"
        attributes = pattern_attributes(row.title, due, row.amount_toman)
        price = message_price(render_pattern(settings.sms_reminder_body, attributes))
        authorized = row.sms_family_id is not None and is_member(db, row.sms_family_id, row.user_id)
        for recipient in [row.user_id, *row.recipient_user_ids]:
            attempt_id = uuid4()
            attempt = SmsAttempt(id=attempt_id, reminder_id=row.id, revision=row.sms_revision,
                recipient_user_id=recipient, due_at=due, attempted_at=now, status="unknown")
            db.add(attempt)
            if (not authorized or not is_member(db, row.sms_family_id, recipient)
                    or notification_phone(db, recipient) is None
                    or not reserve_sms(db, row.sms_family_id, attempt_id, price)):
                attempt.status = "skipped"
                continue
            # Each recipient owns a separate reservation, job and refund reference.
            enqueue_sms(db, kind="reminder", reference_id=attempt_id, priority=10,
                        available_at=now, expires_at=due + MAX_LATENESS,
                        secret_key=settings.secret_key,
                        payload={"pattern": settings.sms_reminder_template, "attributes": attributes})
        db.flush()
        update_status(db, row, due)
        if row.sms_status == "unknown":
            row.sms_status = "pending"
        return True


def deliver(db, settings, sender, attempt_id, payload, now):
    attempt = db.get(SmsAttempt, attempt_id)
    if attempt is None:
        return "skipped"
    row = db.scalar(select(Reminder).where(Reminder.id == attempt.reminder_id).with_for_update())
    if (row is None or row.deleted_at is not None or row.sms_revision != attempt.revision
            or attempt.due_at + MAX_LATENESS <= max(now, datetime.now(UTC))):
        return "skipped"
    if row.sms_family_id is None or not is_member(db, row.sms_family_id, row.user_id):
        return "skipped"
    if notification_phone(db, row.user_id) is None:
        return "skipped"
    recipient = attempt.recipient_user_id
    if (recipient != row.user_id and recipient not in row.recipient_user_ids
            or not is_member(db, row.sms_family_id, recipient)):
        return "skipped"
    phone = notification_phone(db, recipient)
    if phone is None:
        return "skipped"
    # Jobs created before wallet billing was deployed have no prepaid reservation.
    if not sms_reserved(db, attempt_id):
        return "skipped"
    # Legacy jobs have no priced content snapshot: refund rather than send at a guessed price.
    if not payload.get("pattern") or not payload.get("attributes"):
        return "skipped"
    sender.send_pattern(phone, payload["pattern"], payload["attributes"])
    return "accepted"


def record_result(db, attempt_id, status):
    attempt = db.get(SmsAttempt, attempt_id)
    if attempt is None:
        return
    attempt.status = "skipped" if status == "failed" else status
    row = db.scalar(select(Reminder).where(Reminder.id == attempt.reminder_id).with_for_update())
    settle_sms(db, attempt_id, status)
    if row is None or row.deleted_at is not None or row.sms_revision != attempt.revision:
        return
    # An old queued result must not overwrite a later recurrence's status.
    latest = db.scalar(select(SmsAttempt.due_at).where(
        SmsAttempt.reminder_id == row.id, SmsAttempt.revision == row.sms_revision,
    ).order_by(SmsAttempt.due_at.desc()).limit(1))
    if latest == attempt.due_at:
        db.flush()
        update_status(db, row, attempt.due_at)


def update_status(db, row, due):
    statuses = set(db.scalars(select(SmsAttempt.status).where(
        SmsAttempt.reminder_id == row.id, SmsAttempt.revision == row.sms_revision,
        SmsAttempt.due_at == due)))
    # Never present a partially successful occurrence as fully accepted.
    row.sms_status = next((s for s in ("unknown", "skipped", "accepted") if s in statuses), "skipped")
