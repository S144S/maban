from datetime import UTC, datetime, time, timedelta
from typing import Protocol
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.income.models import IncomeEntry


class FamilyAccess(Protocol):
    def authorize(self, family_id: UUID, user_id: UUID) -> None: ...
    def require_member(self, family_id: UUID, member_id: UUID) -> None: ...


class LocationDirectory(Protocol):
    def require(self, family_id: UUID, user_id: UUID, location_id: UUID) -> str: ...


class IncomeError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.message, self.status = message, status


class Income:
    def __init__(self, db: Session, access: FamilyAccess, locations: LocationDirectory):
        self.db, self.access, self.locations = db, access, locations

    @staticmethod
    def view(row):
        return {
            "id": str(row.id),
            "amount_toman": row.amount_toman,
            "source": row.source,
            "from_member_id": str(row.from_member_id),
            "location_id": str(row.location_id) if row.location_id else None,
            "location_name": row.location_name,
            "description": row.description,
            "created_at": row.created_at.isoformat(),
        }

    def create(self, family_id, user_id, data):
        self.access.authorize(family_id, user_id)
        self.access.require_member(family_id, data.from_member_id)
        values = {
            "family_id": family_id,
            "amount_toman": data.amount_toman,
            "source": data.source,
            "from_member_id": data.from_member_id,
            "location_id": data.location_id,
            "description": data.description or None,
            "created_by": user_id,
            "request_id": data.request_id,
        }
        existing = self.db.scalar(select(IncomeEntry).where(
            IncomeEntry.family_id == family_id, IncomeEntry.request_id == data.request_id
        ))
        if existing is not None:
            if any(getattr(existing, key) != value for key, value in values.items()):
                raise IncomeError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
            return self.view(existing)
        values["location_name"] = (self.locations.require(family_id, user_id, data.location_id)
                                   if data.location_id else None)
        self.db.execute(
            insert(IncomeEntry)
            .values(id=uuid4(), created_at=datetime.now(UTC), **values)
            .on_conflict_do_nothing(constraint="income_request")
        )
        row = self.db.scalar(
            select(IncomeEntry).where(
                IncomeEntry.family_id == family_id, IncomeEntry.request_id == data.request_id
            )
        )
        # The recorded name is a historical snapshot, not part of the client request.
        if any(getattr(row, key) != value for key, value in values.items() if key != "location_name"):
            raise IncomeError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
        return self.view(row)

    def list(self, family_id, user_id, offset):
        self.access.authorize(family_id, user_id)
        query = select(IncomeEntry).where(IncomeEntry.family_id == family_id)
        rows = self.db.scalars(
            query.order_by(IncomeEntry.created_at.desc(), IncomeEntry.id.desc()).offset(offset).limit(50)
        ).all()
        count, total = self.db.execute(
            select(func.count(), func.coalesce(func.sum(IncomeEntry.amount_toman), 0)).where(
                IncomeEntry.family_id == family_id
            )
        ).one()
        return {
            "entries": [self.view(row) for row in rows],
            "count": count,
            "total_toman": str(total),
            "currency": "IRT",
            "offset": offset,
        }


    def report(self, family_id, user_id, start, end, offset):
        self.access.authorize(family_id, user_id)
        zone = ZoneInfo("Asia/Tehran")
        since = datetime.combine(start, time.min, zone)
        until = datetime.combine(end + timedelta(days=1), time.min, zone)
        previous = since - (until - since)
        scope = IncomeEntry.family_id == family_id
        period = (scope, IncomeEntry.created_at >= since, IncomeEntry.created_at < until)
        count, total = self.db.execute(select(func.count(), func.coalesce(func.sum(IncomeEntry.amount_toman), 0))
            .where(*period)).one()
        previous_total = self.db.scalar(select(func.coalesce(func.sum(IncomeEntry.amount_toman), 0))
            .where(scope, IncomeEntry.created_at >= previous, IncomeEntry.created_at < since))
        day = func.date(func.timezone("Asia/Tehran", IncomeEntry.created_at))
        daily = self.db.execute(select(day, func.sum(IncomeEntry.amount_toman), func.count())
            .where(*period).group_by(day).order_by(day)).all()
        group_name = IncomeEntry.source
        group_key = IncomeEntry.source
        groups = self.db.execute(select(group_key, group_name, func.sum(IncomeEntry.amount_toman), func.count())
            .where(*period).group_by(group_key, group_name)
            .order_by(func.sum(IncomeEntry.amount_toman).desc(), group_key)).all()
        rows = self.db.scalars(select(IncomeEntry).where(*period)
            .order_by(IncomeEntry.created_at.desc(), IncomeEntry.id.desc()).offset(offset).limit(20)).all()
        return {"total_toman": str(total), "count": count, "previous_total_toman": str(previous_total),
                "start": start.isoformat(), "end": end.isoformat(),
                "previous_start": previous.date().isoformat(), "previous_end": (start - timedelta(days=1)).isoformat(),
                "daily": [{"date": d.isoformat(), "total_toman": str(v), "count": n} for d, v, n in daily],
                "groups": [{"key": k, "name": label, "total_toman": str(v), "count": n} for k, label, v, n in groups],
                "entries": [self.view(row) for row in rows], "offset": offset}
