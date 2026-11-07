import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.plants.models import CareEvent, Plant

# Families have no timezone setting yet. All daily care uses this explicit default.
TIMEZONE = "Asia/Tehran"


def now():
    return datetime.now(UTC)


def next_due(performed_at: datetime, interval: int, timezone: str = TIMEZONE):
    if performed_at.tzinfo is None or performed_at.utcoffset() is None:
        raise ValueError("Care time must include a timezone")
    return performed_at.astimezone(ZoneInfo(timezone)).date() + timedelta(days=interval)


def fingerprint(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


class FamilyAccess(Protocol):
    def authorize(self, family_id: UUID, user_id: UUID) -> None: ...
    def require_member(self, family_id: UUID, member_id: UUID) -> None: ...


class PlantError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.message, self.status = message, status


class Plants:
    def __init__(self, db: Session, access: FamilyAccess):
        self.db, self.access = db, access

    def lock(self, family_id):
        # Same module lock for creation, schedule edits, deletion and care retries.
        self.db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                        {"key": f"plants/{family_id}"})

    def view(self, row):
        today = now().astimezone(ZoneInfo(TIMEZONE)).date()

        def schedule(interval, due):
            return None if due is None else {"interval_days": interval, "next_due": due.isoformat(),
                                            "status": "overdue" if due < today else "today" if due == today else "upcoming"}

        return {"id": str(row.id), "name": row.name, "species": row.species,
                "location": row.location, "note": row.note,
                "assignee_id": str(row.assignee_id) if row.assignee_id else None,
                "soil": schedule(row.soil_interval, row.soil_due),
                "fertilizer": schedule(row.fertilizer_interval, row.fertilizer_due)}

    def get(self, family_id, plant_id, include_deleted=False):
        row = self.db.scalar(select(Plant).where(Plant.family_id == family_id, Plant.id == plant_id))
        if row is None or row.deleted_at is not None and not include_deleted:
            raise PlantError("گلدون پیدا نشد یا بهش دسترسی ندارین.", 404)
        return row

    def list(self, family_id, user_id, offset):
        self.access.authorize(family_id, user_id)
        query = select(Plant).where(Plant.family_id == family_id, Plant.deleted_at.is_(None))
        due = func.least(Plant.soil_due, Plant.fertilizer_due)
        rows = self.db.scalars(query.order_by(due, Plant.id).offset(offset).limit(51)).all()
        return {"plants": [self.view(row) for row in rows[:50]], "has_more": len(rows) > 50,
                "timezone": TIMEZONE}

    def detail(self, family_id, user_id, plant_id):
        self.access.authorize(family_id, user_id)
        return {"plant": self.view(self.get(family_id, plant_id)), "timezone": TIMEZONE}

    def create(self, family_id, user_id, data):
        self.access.authorize(family_id, user_id)
        self.lock(family_id)
        fields = data.model_dump(exclude={"request_id"})
        digest = fingerprint({**fields, "actor_id": user_id})
        row = self.db.scalar(select(Plant).where(Plant.family_id == family_id,
                                               Plant.request_id == data.request_id))
        if row:
            if row.request_fingerprint != digest or row.deleted_at is not None:
                raise PlantError("این درخواست قبلاً ثبت شده؛ فرم رو دوباره باز کنین.")
            return self.view(row)
        if data.assignee_id:
            self.access.require_member(family_id, data.assignee_id)
        row = Plant(id=uuid4(), family_id=family_id, **fields, created_by=user_id,
                    request_id=data.request_id, request_fingerprint=digest, created_at=now())
        self.db.add(row)
        self.db.flush()
        return self.view(row)

    def update(self, family_id, user_id, plant_id, data):
        self.access.authorize(family_id, user_id)
        self.lock(family_id)
        row = self.get(family_id, plant_id)
        if data.assignee_id:
            self.access.require_member(family_id, data.assignee_id)
        for key, value in data.model_dump().items():
            setattr(row, key, value)
        self.db.flush()
        return self.view(row)

    def delete(self, family_id, user_id, plant_id):
        self.access.authorize(family_id, user_id)
        self.lock(family_id)
        row = self.get(family_id, plant_id, include_deleted=True)
        row.deleted_at = row.deleted_at or now()
        self.db.flush()

    @staticmethod
    def event_view(row):
        return {"id": str(row.id), "actor_id": str(row.actor_id), "action": row.action,
                "note": row.note, "performed_at": row.performed_at.isoformat(),
                "next_due": row.next_due.isoformat()}

    def care(self, family_id, user_id, plant_id, data):
        self.access.authorize(family_id, user_id)
        self.lock(family_id)
        row = self.get(family_id, plant_id)
        digest = fingerprint({"plant_id": plant_id, "actor_id": user_id,
                              "action": data.action, "note": data.note})
        existing = self.db.scalar(select(CareEvent).where(CareEvent.family_id == family_id,
                                                         CareEvent.request_id == data.request_id))
        if existing:
            if existing.request_fingerprint != digest:
                raise PlantError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
            return self.event_view(existing)
        fertilizer = data.action == "fertilized"
        interval = row.fertilizer_interval if fertilizer else row.soil_interval
        if interval is None:
            raise PlantError("اول برنامهٔ کوددهی رو برای این گلدون تنظیم کنین.")
        performed = now()
        due = next_due(performed, interval)
        event = CareEvent(id=uuid4(), family_id=family_id, plant_id=plant_id, actor_id=user_id,
                          action=data.action, note=data.note, performed_at=performed, next_due=due,
                          request_id=data.request_id, request_fingerprint=digest)
        if fertilizer:
            row.fertilizer_due = due
        else:
            row.soil_due = due
        self.db.add(event)
        self.db.flush()
        return self.event_view(event)

    def history(self, family_id, user_id, plant_id, offset):
        self.access.authorize(family_id, user_id)
        self.get(family_id, plant_id)
        rows = self.db.scalars(select(CareEvent).where(CareEvent.family_id == family_id,
            CareEvent.plant_id == plant_id).order_by(CareEvent.performed_at.desc(), CareEvent.id.desc())
            .offset(offset).limit(51)).all()
        return {"events": [self.event_view(row) for row in rows[:50]], "has_more": len(rows) > 50}
