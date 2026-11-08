import hashlib
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.plants.errors import PlantError
from app.plants.models import CareEvent, Plant
from app.plants.photos import normalize_photo
from app.plants.storage import PhotoStorage

# Families have no timezone setting yet. All daily care uses this explicit default.
TIMEZONE = "Asia/Tehran"
logger = logging.getLogger(__name__)


def lock_family(db, family_id):
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
               {"key": f"plants/{family_id}"})


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


class Plants:
    def __init__(self, db: Session, access: FamilyAccess, photos: PhotoStorage):
        self.db, self.access, self.photos = db, access, photos
        self.uploaded: set[str] = set()
        self.obsolete: set[str] = set()

    def cleanup_photos(self, committed):
        # Object storage cannot join a PostgreSQL transaction. Never delete an old
        # object before commit. A failed DB commit can have an ambiguous outcome;
        # leave uploads for reconciliation, which checks committed references.
        if not committed:
            if self.uploaded:
                logger.warning("Plant upload may be unreferenced; run app.plants.cleanup")
            return
        for key in self.obsolete:
            try:
                self.photos.remove(key)
            except PlantError:
                # A crash or storage outage is reconciled by plants.cleanup.
                logger.warning("Plant photo cleanup deferred; run app.plants.cleanup")

    def clear_photo(self, row):
        if row.photo_key:
            self.obsolete.add(row.photo_key)
        row.photo_key = row.photo_digest = None

    def lock(self, family_id):
        # Same module lock for creation, schedule edits, deletion and care retries.
        lock_family(self.db, family_id)

    def view(self, row):
        today = now().astimezone(ZoneInfo(TIMEZONE)).date()

        def schedule(interval, due):
            return None if due is None else {"interval_days": interval, "next_due": due.isoformat(),
                                            "status": "overdue" if due < today else "today" if due == today else "upcoming"}

        return {"id": str(row.id), "name": row.name, "species": row.species,
                "location": row.location, "note": row.note,
                "assignee_id": str(row.assignee_id) if row.assignee_id else None,
                "photo_url": f"/api/families/{row.family_id}/plants/{row.id}/photo?v={row.photo_digest}" if row.photo_digest else None,
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
        self.clear_photo(row)
        self.db.flush()

    def photo(self, family_id, user_id, plant_id):
        self.access.authorize(family_id, user_id)
        # Serialize reads with replacement/deletion until the bytes are obtained.
        self.lock(family_id)
        row = self.get(family_id, plant_id)
        if not row.photo_digest:
            raise PlantError("این گلدون هنوز عکسی نداره.", 404)
        return self.photos.get(row.photo_key)

    def set_photo(self, family_id, user_id, plant_id, data, content_type):
        self.access.authorize(family_id, user_id)
        self.lock(family_id)
        row = self.get(family_id, plant_id)
        photo = normalize_photo(data, content_type)
        digest = hashlib.sha256(photo).hexdigest()
        if row.photo_digest == digest:
            # Also repairs a missing object without changing its existing receipt.
            self.photos.put(row.photo_key, photo)
            return self.view(row)
        key = f"plants/{family_id}/{plant_id}/{uuid4().hex}.jpg"
        self.uploaded.add(key)  # Track even an ambiguous upload timeout for cleanup.
        self.photos.put(key, photo)
        self.clear_photo(row)
        row.photo_key, row.photo_digest = key, digest
        self.db.flush()
        return self.view(row)

    def remove_photo(self, family_id, user_id, plant_id):
        self.access.authorize(family_id, user_id)
        self.lock(family_id)
        row = self.get(family_id, plant_id)
        self.clear_photo(row)
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
