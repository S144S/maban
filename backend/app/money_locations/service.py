from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.money_locations.models import MoneyLocation


class FamilyAccess(Protocol):
    def authorize(self, family_id: UUID, user_id: UUID) -> None: ...

    def require_owner(self, family_id: UUID, user_id: UUID) -> None: ...


class LocationError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.message, self.status = message, status


class Locations:
    def __init__(self, db: Session, access: FamilyAccess):
        self.db, self.access = db, access

    @staticmethod
    def view(row):
        return {"id": str(row.id), "name": row.name, "created_at": row.created_at.isoformat()}

    def list(self, family_id, user_id):
        self.access.authorize(family_id, user_id)
        rows = self.db.scalars(select(MoneyLocation).where(MoneyLocation.family_id == family_id, MoneyLocation.deleted_at.is_(None))
                               .order_by(MoneyLocation.created_at, MoneyLocation.id)).all()
        return {"locations": [self.view(row) for row in rows]}

    def create(self, family_id, user_id, data):
        self.access.require_owner(family_id, user_id)
        self.db.execute(insert(MoneyLocation).values(
            id=uuid4(), family_id=family_id, name=data.name,
            created_by=user_id, request_id=data.request_id, created_at=datetime.now(UTC),
        ).on_conflict_do_nothing())
        row = self.db.scalar(select(MoneyLocation).where(
            MoneyLocation.family_id == family_id, MoneyLocation.request_id == data.request_id))
        if row is None:
            raise LocationError("حسابی با این نام از قبل وجود داره؛ نام دیگه‌ای انتخاب کنین.")
        if row.deleted_at is not None:
            raise LocationError("این حساب حذف شده؛ برای ساخت حساب جدید، درخواست تازه‌ای ثبت کنین.")
        if row.name != data.name or row.created_by != user_id:
            raise LocationError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
        return self.view(row)

    def require(self, family_id, user_id, location_id):
        self.access.authorize(family_id, user_id)
        row = self.db.scalar(select(MoneyLocation).where(
            MoneyLocation.family_id == family_id, MoneyLocation.deleted_at.is_(None), MoneyLocation.id == location_id))
        if row is None:
            raise LocationError("حساب در این خانواده پیدا نشد؛ دوباره انتخاب کنین.", 404)
        return row.name

    def rename(self, family_id, user_id, location_id, data):
        self.access.require_owner(family_id, user_id)
        row = self.db.scalar(select(MoneyLocation).where(
            MoneyLocation.family_id == family_id, MoneyLocation.deleted_at.is_(None), MoneyLocation.id == location_id
        ).with_for_update())
        if row is None:
            raise LocationError("حساب در این خانواده پیدا نشد؛ دوباره انتخاب کنین.", 404)
        try:
            with self.db.begin_nested():
                row.name = data.name
                self.db.flush()
        except IntegrityError as error:
            if getattr(getattr(error.orig, "diag", None), "constraint_name", None) != "location_family_name":
                raise
            raise LocationError("حسابی با این نام از قبل وجود داره؛ نام دیگه‌ای انتخاب کنین.") from error
        return self.view(row)

    def delete(self, family_id, user_id, location_id):
        self.access.require_owner(family_id, user_id)
        row = self.db.scalar(select(MoneyLocation).where(
            MoneyLocation.family_id == family_id, MoneyLocation.id == location_id
        ).with_for_update())
        if row is None:
            raise LocationError("حساب در این خانواده پیدا نشد.", 404)
        if row.deleted_at is None:
            row.deleted_at = datetime.now(UTC)
            self.db.flush()
