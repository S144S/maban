from datetime import UTC, datetime, time, timedelta
from typing import Protocol
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import String, cast, func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.expenses.models import ExpenseCategory, ExpenseEntry


class FamilyAccess(Protocol):
    def authorize(self, family_id: UUID, user_id: UUID) -> None: ...
    def require_owner(self, family_id: UUID, user_id: UUID) -> None: ...
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
            "category_id": str(row.category_id) if row.category_id else None,
            "category_name": row.category_name or {"home": "خانه", "groceries": "خرید روزمره", "leisure": "تفریح", "other": "سایر"}[row.category],
            "paid_by_member_id": str(row.paid_by_member_id),
            "title": row.title,
            "description": row.description,
            "created_at": row.created_at.isoformat(),
        }

    def create(self, family_id, user_id, data):
        self.access.authorize(family_id, user_id)
        self.access.require_member(family_id, data.paid_by_member_id)
        self.lock_categories(family_id)
        submitted = {
            "amount_toman": data.amount_toman, "category": data.category or "other",
            "submitted_category_id": data.category_id, "paid_by_member_id": data.paid_by_member_id,
            "title": data.title, "description": data.description or None, "created_by": user_id,
        }
        existing = self.db.scalar(select(ExpenseEntry).where(
            ExpenseEntry.family_id == family_id, ExpenseEntry.request_id == data.request_id))
        if existing is not None:
            if any(getattr(existing, key) != value for key, value in submitted.items()):
                raise ExpenseError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
            return self.view(existing)
        category = None
        if data.category_id is not None:
            category = self.db.scalar(select(ExpenseCategory).where(
                ExpenseCategory.id == data.category_id, ExpenseCategory.family_id == family_id
            ))
            if category is None:
                raise ExpenseError("دسته‌بندی در این خانواده پیدا نشد؛ دوباره انتخاب کنین.", 404)
        values = {
            "family_id": family_id,
            "amount_toman": data.amount_toman,
            "category": data.category or "other",
            "category_id": data.category_id,
            "submitted_category_id": data.category_id,
            "category_name": category.name if category else None,
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


    @staticmethod
    def category_view(row):
        return {"id": str(row.id), "name": row.name, "icon": row.icon, "is_default": row.name == "سایر",
                "monthly_limit_toman": row.monthly_limit_toman}

    def categories(self, family_id, user_id):
        self.access.authorize(family_id, user_id)
        self.lock_categories(family_id)
        self.ensure_default(family_id, user_id)
        rows = self.db.scalars(select(ExpenseCategory).where(ExpenseCategory.family_id == family_id)
                               .order_by(ExpenseCategory.created_at, ExpenseCategory.id))
        return {"categories": [self.category_view(row) for row in rows]}

    def create_category(self, family_id, user_id, data):
        self.access.require_owner(family_id, user_id)
        self.lock_categories(family_id)
        self.ensure_default(family_id, user_id)
        self.db.execute(insert(ExpenseCategory).values(
            id=uuid4(), family_id=family_id, name=data.name, icon=data.icon, created_by=user_id,
            request_id=data.request_id, created_at=datetime.now(UTC),
        ).on_conflict_do_nothing())
        row = self.db.scalar(select(ExpenseCategory).where(
            ExpenseCategory.family_id == family_id, ExpenseCategory.request_id == data.request_id))
        if row is None:
            raise ExpenseError("این دسته‌بندی از قبل وجود داره؛ نام دیگه‌ای انتخاب کنین.")
        if row.name != data.name or row.icon != data.icon or row.created_by != user_id:
            raise ExpenseError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
        return self.category_view(row)

    def lock_categories(self, family_id):
        # Serialize category changes and expense assignment within this module/family.
        self.db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                        {"key": f"expenses/categories/{family_id}"})

    def ensure_default(self, family_id, user_id):
        row = self.db.scalar(select(ExpenseCategory).where(
            ExpenseCategory.family_id == family_id, ExpenseCategory.name == "سایر"))
        if row is None:
            row = ExpenseCategory(id=uuid4(), family_id=family_id, name="سایر", icon="tag",
                                  created_by=user_id, request_id=uuid4(), created_at=datetime.now(UTC))
            self.db.add(row)
            self.db.flush()
        return row

    def editable_category(self, family_id, user_id, category_id):
        self.access.require_owner(family_id, user_id)
        self.lock_categories(family_id)
        row = self.db.scalar(select(ExpenseCategory).where(
            ExpenseCategory.family_id == family_id, ExpenseCategory.id == category_id))
        if row is None:
            raise ExpenseError("دسته‌بندی پیدا نشد.", 404)
        if row.name == "سایر":
            raise ExpenseError("دسته‌بندی پیش‌فرض سایر قابل تغییر یا حذف نیست.")
        return row

    def update_category(self, family_id, user_id, category_id, data):
        row = self.editable_category(family_id, user_id, category_id)
        self.ensure_default(family_id, user_id)
        duplicate = self.db.scalar(select(ExpenseCategory.id).where(
            ExpenseCategory.family_id == family_id, ExpenseCategory.name == data.name,
            ExpenseCategory.id != category_id))
        if duplicate:
            raise ExpenseError("این دسته‌بندی از قبل وجود داره؛ نام دیگه‌ای انتخاب کنین.")
        row.name, row.icon = data.name, data.icon
        self.db.execute(update(ExpenseEntry).where(
            ExpenseEntry.family_id == family_id, ExpenseEntry.category_id == category_id
        ).values(category_name=data.name))
        self.db.flush()
        return self.category_view(row)

    def delete_category(self, family_id, user_id, category_id):
        row = self.editable_category(family_id, user_id, category_id)
        default = self.ensure_default(family_id, user_id)
        self.db.execute(update(ExpenseEntry).where(
            ExpenseEntry.family_id == family_id, ExpenseEntry.category_id == category_id
        ).values(category_id=default.id, category_name=default.name))
        self.db.delete(row)
        self.db.flush()

    def set_category_monthly_limit(self, family_id, user_id, category_id, data):
        self.access.require_owner(family_id, user_id)
        self.lock_categories(family_id)
        row = self.db.scalar(select(ExpenseCategory).where(
            ExpenseCategory.family_id == family_id, ExpenseCategory.id == category_id))
        if row is None:
            raise ExpenseError("دسته‌بندی پیدا نشد.", 404)
        # A recurring monthly target, not a transaction-blocking limit.
        # The default category can have a target while its identity stays protected.
        row.monthly_limit_toman = data.monthly_limit_toman
        self.db.flush()
        return self.category_view(row)


    def report(self, family_id, user_id, start, end, offset):
        self.access.authorize(family_id, user_id)
        zone = ZoneInfo("Asia/Tehran")
        since = datetime.combine(start, time.min, zone)
        until = datetime.combine(end + timedelta(days=1), time.min, zone)
        previous = since - (until - since)
        scope = ExpenseEntry.family_id == family_id
        period = (scope, ExpenseEntry.created_at >= since, ExpenseEntry.created_at < until)
        count, total = self.db.execute(select(func.count(), func.coalesce(func.sum(ExpenseEntry.amount_toman), 0))
            .where(*period)).one()
        previous_total = self.db.scalar(select(func.coalesce(func.sum(ExpenseEntry.amount_toman), 0))
            .where(scope, ExpenseEntry.created_at >= previous, ExpenseEntry.created_at < since))
        day = func.date(func.timezone("Asia/Tehran", ExpenseEntry.created_at))
        daily = self.db.execute(select(day, func.sum(ExpenseEntry.amount_toman), func.count())
            .where(*period).group_by(day).order_by(day)).all()
        group_name = func.coalesce(ExpenseEntry.category_name, ExpenseEntry.category)
        group_key = func.coalesce(cast(ExpenseEntry.category_id, String), ExpenseEntry.category)
        groups = self.db.execute(select(group_key, group_name, func.sum(ExpenseEntry.amount_toman), func.count())
            .where(*period).group_by(group_key, group_name)
            .order_by(func.sum(ExpenseEntry.amount_toman).desc(), group_key)).all()
        rows = self.db.scalars(select(ExpenseEntry).where(*period)
            .order_by(ExpenseEntry.created_at.desc(), ExpenseEntry.id.desc()).offset(offset).limit(20)).all()
        return {"total_toman": str(total), "count": count, "previous_total_toman": str(previous_total),
                "start": start.isoformat(), "end": end.isoformat(),
                "previous_start": previous.date().isoformat(), "previous_end": (start - timedelta(days=1)).isoformat(),
                "daily": [{"date": d.isoformat(), "total_toman": str(v), "count": n} for d, v, n in daily],
                "groups": [{"key": k, "name": label, "total_toman": str(v), "count": n} for k, label, v, n in groups],
                "entries": [self.view(row) for row in rows], "offset": offset}
