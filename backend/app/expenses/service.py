from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.expenses.models import ExpenseEntry


class FamilyAccess(Protocol):
    def authorize(self, family_id: UUID, user_id: UUID, *, write: bool = False) -> None: ...
    def require_member(self, family_id: UUID, member_id: UUID) -> None: ...


class ExpenseError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.message, self.status = message, status


class Expense:
    def __init__(self, db: Session, access: FamilyAccess):
        self.db, self.access = db, access

    @staticmethod
    def view(row):
        return {
            "id": str(row.id),
            "amount_toman": row.amount_toman,
            "category": row.category,
            "paid_by_member_id": str(row.paid_by_member_id),
            "title": row.title,
            "description": row.description,
            "created_at": row.created_at.isoformat(),
        }

    def create(self, family_id, user_id, data):
        self.access.authorize(family_id, user_id, write=True)
        self.access.require_member(family_id, data.paid_by_member_id)
        values = {
            "family_id": family_id,
            "amount_toman": data.amount_toman,
            "category": data.category,
            "paid_by_member_id": data.paid_by_member_id,
            "title": data.title,
            "description": data.description or None,
            "created_by": user_id,
            "request_id": data.request_id,
        }
        self.db.execute(
            insert(ExpenseEntry)
            .values(id=uuid4(), created_at=datetime.now(UTC), **values)
            .on_conflict_do_nothing(constraint="expenses_request")
        )
        row = self.db.scalar(
            select(ExpenseEntry).where(
                ExpenseEntry.family_id == family_id, ExpenseEntry.request_id == data.request_id
            )
        )
        if any(getattr(row, key) != value for key, value in values.items()):
            raise ExpenseError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
        return self.view(row)

    def list(self, family_id, user_id, offset):
        self.access.authorize(family_id, user_id)
        query = select(ExpenseEntry).where(ExpenseEntry.family_id == family_id)
        rows = self.db.scalars(
            query.order_by(ExpenseEntry.created_at.desc(), ExpenseEntry.id.desc()).offset(offset).limit(50)
        ).all()
        count, total = self.db.execute(
            select(func.count(), func.coalesce(func.sum(ExpenseEntry.amount_toman), 0)).where(
                ExpenseEntry.family_id == family_id
            )
        ).one()
        return {
            "entries": [self.view(row) for row in rows],
            "count": count,
            "total_toman": str(total),
            "currency": "IRT",
            "offset": offset,
        }
