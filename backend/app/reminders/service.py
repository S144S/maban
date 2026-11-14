import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.families.public import is_member
from app.reminders.models import Reminder
from app.reminders.scheduling import occurrence_window


class ReminderError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.message, self.status = message, status


class PlantAccess(Protocol):
    def authorize(self, family_id: UUID, user_id: UUID, plant_id: UUID) -> None: ...


class Reminders:
    def __init__(self, db: Session, plants: PlantAccess, sms_enabled: bool = False):
        self.db = db
        self.plants = plants
        self.sms_enabled = sms_enabled

    def view(self, row):
        status = row.sms_status
        if row.sms_family_id is None:
            status = "not_available"
        elif status == "pending":
            status = "scheduled" if self.sms_enabled else "not_available"
        return {"id": str(row.id), "title": row.title, "note": row.note, "due_at": row.due_at.isoformat(),
                "recurrence": row.recurrence,
                "sms_family_id": str(row.sms_family_id) if row.sms_family_id else None,
                "recipient_user_ids": [str(uid) for uid in row.recipient_user_ids],
                "amount_toman": row.amount_toman, "delivery_status": status,
                "plant_family_id": str(row.plant_family_id) if row.plant_family_id else None,
                "plant_id": str(row.plant_id) if row.plant_id else None,
                "next_delivery_at": row.next_sms_at.isoformat() if self.sms_enabled and row.sms_family_id and row.next_sms_at else None}

    def list(self, user_id, offset):
        rows = self.db.scalars(select(Reminder).where(
            Reminder.user_id == user_id, Reminder.deleted_at.is_(None)
        ).order_by(Reminder.due_at, Reminder.id).offset(offset).limit(51)).all()
        return {"reminders": [self.view(row) for row in rows[:50]], "has_more": len(rows) > 50}

    def upcoming(self, user_id, offset=0, *, now=None):
        now = now or datetime.now(UTC)
        end = now + timedelta(hours=24)
        rows = self.db.scalars(select(Reminder).where(
            Reminder.user_id == user_id, Reminder.deleted_at.is_(None), Reminder.due_at <= end,
        ).execution_options(yield_per=100))
        matches = []
        for row in rows:
            due, following = occurrence_window(row.due_at, row.recurrence, now)
            next_due = due if due >= now else following
            if next_due is not None and now <= next_due <= end:
                matches.append({**self.view(row), "occurrence_at": next_due.isoformat()})
        matches.sort(key=lambda item: (item["occurrence_at"], item["id"]))
        return {"reminders": matches[offset:offset + 50], "has_more": len(matches) > offset + 50}

    def create(self, user_id, data):
        fields = data.model_dump(exclude={"request_id"})
        # Preserve fingerprints from before recurrence was introduced.
        fingerprint_fields = {**fields, "due_at": data.due_at.isoformat()}
        if data.recurrence == "none":
            fingerprint_fields.pop("recurrence")
        if data.note is None:
            fingerprint_fields.pop("note")
        if data.plant_id is None:
            fingerprint_fields.pop("plant_id")
            fingerprint_fields.pop("plant_family_id")
        if data.sms_family_id is None:
            fingerprint_fields.pop("sms_family_id")
        if not data.recipient_user_ids:
            fingerprint_fields.pop("recipient_user_ids")
        fingerprint = hashlib.sha256(json.dumps(
            fingerprint_fields, sort_keys=True, default=str
        ).encode()).hexdigest()
        existing = self.db.scalar(select(Reminder).where(
            Reminder.user_id == user_id, Reminder.request_id == data.request_id))
        self.authorize_sms(user_id, data.sms_family_id)
        self.authorize_recipients(user_id, data.sms_family_id, data.recipient_user_ids)
        if existing is None and data.plant_id is not None:
            self.plants.authorize(data.plant_family_id, user_id, data.plant_id)
        self.db.execute(insert(Reminder).values(
            id=uuid4(), user_id=user_id, **fields, request_id=data.request_id,
            request_fingerprint=fingerprint, created_at=datetime.now(UTC), next_sms_at=data.due_at,
        ).on_conflict_do_nothing(constraint="reminder_request"))
        row = self.db.scalar(select(Reminder).where(
            Reminder.user_id == user_id, Reminder.request_id == data.request_id))
        if row.deleted_at is not None or row.request_fingerprint != fingerprint:
            raise ReminderError("این درخواست قبلاً ثبت شده؛ برای یادآور جدید، فرم رو دوباره باز کنین.")
        return self.view(row)

    def authorize_sms(self, user_id, family_id):
        if family_id is not None and not is_member(self.db, family_id, user_id):
            raise ReminderError("به خانوادهٔ پرداخت‌کننده دسترسی ندارین.", 404)

    def owned(self, user_id, reminder_id):
        row = self.db.scalar(select(Reminder).where(
            Reminder.user_id == user_id, Reminder.id == reminder_id
        ).with_for_update())
        if row is None:
            raise ReminderError("یادآور پیدا نشد.", 404)
        return row

    def authorize_recipients(self, user_id, family_id, recipients):
        if not recipients:
            return
        if family_id is None:
            raise ReminderError("برای یادآوری به اعضا، خانوادهٔ ارسال پیامک رو انتخاب کنین.", 422)
        self.authorize_sms(user_id, family_id)
        if user_id in recipients or any(not is_member(self.db, family_id, uid) for uid in recipients):
            raise ReminderError("گیرنده‌ها باید از اعضای دیگر خانوادهٔ انتخاب‌شده باشن.", 422)

    def update(self, user_id, reminder_id, data):
        row = self.owned(user_id, reminder_id)
        if row.deleted_at is not None:
            raise ReminderError("یادآور پیدا نشد.", 404)
        if "sms_family_id" in data.model_fields_set:
            self.authorize_sms(user_id, data.sms_family_id)
        if {"sms_family_id", "recipient_user_ids"} & data.model_fields_set:
            self.authorize_recipients(user_id,
                data.sms_family_id if "sms_family_id" in data.model_fields_set else row.sms_family_id,
                data.recipient_user_ids if "recipient_user_ids" in data.model_fields_set else row.recipient_user_ids)
        reference_given = bool({"plant_family_id", "plant_id"} & data.model_fields_set)
        if reference_given and data.plant_id is not None and (
            row.plant_id != data.plant_id or row.plant_family_id != data.plant_family_id
        ):
            self.plants.authorize(data.plant_family_id, user_id, data.plant_id)
        billing_changed = "sms_family_id" in data.model_fields_set and row.sms_family_id != data.sms_family_id
        recipients_changed = "recipient_user_ids" in data.model_fields_set and row.recipient_user_ids != data.recipient_user_ids
        reschedule = row.due_at != data.due_at or (
            "recurrence" in data.model_fields_set and row.recurrence != data.recurrence
        )
        for key, value in data.model_dump().items():
            if key in {"plant_family_id", "plant_id"} and not reference_given:
                continue
            # Older clients do not know this field and must not reset it.
            if key in {"recurrence", "note", "amount_toman", "sms_family_id", "recipient_user_ids"} and key not in data.model_fields_set:
                continue
            setattr(row, key, value)
        if reschedule or billing_changed or recipients_changed:
            row.sms_revision += 1
        if reschedule:
            row.next_sms_at = row.due_at
            row.sms_status = "pending"
        elif (billing_changed or recipients_changed) and row.next_sms_at is None and row.sms_status == "pending":
            row.sms_status = "skipped"
        self.db.flush()
        return self.view(row)

    def delete(self, user_id, reminder_id):
        row = self.owned(user_id, reminder_id)
        if row.deleted_at is None:
            row.deleted_at = datetime.now(UTC)
            row.next_sms_at = None
            self.db.flush()
