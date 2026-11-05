import hashlib
import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.reminders.models import Reminder


class ReminderError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.message, self.status = message, status


class Reminders:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def view(row):
        return {"id": str(row.id), "title": row.title, "due_at": row.due_at.isoformat(),
                "recurrence": row.recurrence,
                "amount_toman": row.amount_toman, "delivery_status": "not_available"}

    def list(self, user_id, offset):
        rows = self.db.scalars(select(Reminder).where(
            Reminder.user_id == user_id, Reminder.deleted_at.is_(None)
        ).order_by(Reminder.due_at, Reminder.id).offset(offset).limit(51)).all()
        return {"reminders": [self.view(row) for row in rows[:50]], "has_more": len(rows) > 50}

    def create(self, user_id, data):
        fields = data.model_dump(exclude={"request_id"})
        # Preserve fingerprints from before recurrence was introduced.
        fingerprint_fields = {**fields, "due_at": data.due_at.isoformat()}
        if data.recurrence == "none":
            fingerprint_fields.pop("recurrence")
        fingerprint = hashlib.sha256(json.dumps(
            fingerprint_fields, sort_keys=True
        ).encode()).hexdigest()
        self.db.execute(insert(Reminder).values(
            id=uuid4(), user_id=user_id, **fields, request_id=data.request_id,
            request_fingerprint=fingerprint, created_at=datetime.now(UTC),
        ).on_conflict_do_nothing(constraint="reminder_request"))
        row = self.db.scalar(select(Reminder).where(
            Reminder.user_id == user_id, Reminder.request_id == data.request_id))
        if row.deleted_at is not None or row.request_fingerprint != fingerprint:
            raise ReminderError("این درخواست قبلاً ثبت شده؛ برای یادآور جدید، فرم رو دوباره باز کنین.")
        return self.view(row)

    def owned(self, user_id, reminder_id):
        row = self.db.scalar(select(Reminder).where(
            Reminder.user_id == user_id, Reminder.id == reminder_id
        ).with_for_update())
        if row is None:
            raise ReminderError("یادآور پیدا نشد.", 404)
        return row

    def update(self, user_id, reminder_id, data):
        row = self.owned(user_id, reminder_id)
        if row.deleted_at is not None:
            raise ReminderError("یادآور پیدا نشد.", 404)
        for key, value in data.model_dump().items():
            # Older clients do not know this field and must not reset it.
            if key == "recurrence" and key not in data.model_fields_set:
                continue
            setattr(row, key, value)
        self.db.flush()
        return self.view(row)

    def delete(self, user_id, reminder_id):
        row = self.owned(user_id, reminder_id)
        if row.deleted_at is None:
            row.deleted_at = datetime.now(UTC)
            self.db.flush()
