import hashlib
import json
from datetime import UTC, datetime
from typing import Protocol
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.shopping.models import ShoppingCheckout, ShoppingItem, ShoppingList


class FamilyAccess(Protocol):
    def authorize(self, family_id: UUID, user_id: UUID) -> None: ...


class PurchaseExpenses(Protocol):
    def record(self, *, family_id, user_id, item_id, name, quantity, note, amount_toman, category_id) -> UUID: ...


class ShoppingError(Exception):
    def __init__(self, message: str, status: int = 409):
        self.message, self.status = message, status


class Shopping:
    def __init__(self, db: Session, access: FamilyAccess, expenses: PurchaseExpenses):
        self.db, self.access, self.expenses = db, access, expenses

    @staticmethod
    def view(row):
        return {"id": str(row.id), "list_id": str(row.list_id), "name": row.name, "quantity": row.quantity, "note": row.note,
                "purchased": row.purchased_at is not None, "version": row.version,
                "created_at": row.created_at.isoformat(),
                "purchased_at": row.purchased_at.isoformat() if row.purchased_at else None,
                "expense_id": str(row.expense_id) if row.expense_id else None}

    def list(self, family_id, user_id, status, offset, list_id=None):
        self.access.authorize(family_id, user_id)
        scope = (ShoppingItem.family_id == family_id, ShoppingItem.deleted_at.is_(None))
        if list_id is not None:
            self.find_list(family_id, list_id)
            scope += (ShoppingItem.list_id == list_id,)
        purchased = ShoppingItem.purchased_at.is_not(None)
        counts = self.db.execute(select(func.count().filter(~purchased), func.count().filter(purchased))
                                 .where(*scope)).one()
        filtered_scope = scope if status == "all" else (*scope, purchased if status == "purchased" else ~purchased)
        rows = self.db.scalars(select(ShoppingItem).where(*filtered_scope)
            .order_by(ShoppingItem.created_at.desc(), ShoppingItem.id.desc()).offset(offset).limit(50)).all()
        count = sum(counts) if status == "all" else counts[1 if status == "purchased" else 0]
        result = {"items": [self.view(row) for row in rows], "pending_count": counts[0],
                  "purchased_count": counts[1], "has_more": offset + len(rows) < count}
        if list_id is not None:
            result["checkout"] = self.checkout_state(family_id, list_id)
        return result

    def create(self, family_id, user_id, data):
        self.access.authorize(family_id, user_id)
        fields = data.model_dump(exclude={"request_id", "list_id"})
        list_id = data.list_id
        if list_id is None:
            list_id = uuid5(NAMESPACE_URL, f"maban-shopping:{family_id}")
            self.db.execute(insert(ShoppingList).values(id=list_id, family_id=family_id,
                name="لیست خرید", created_by=user_id, created_at=datetime.now(UTC),
                request_id=list_id, request_fingerprint="legacy").on_conflict_do_nothing())
        self.find_list(family_id, list_id)
        fingerprint_fields = {**fields, **({"list_id": str(data.list_id)} if data.list_id else {})}
        digest = hashlib.sha256(json.dumps({**fingerprint_fields, "actor": str(user_id)}, sort_keys=True,
                                           ensure_ascii=False).encode()).hexdigest()
        self.db.execute(insert(ShoppingItem).values(id=uuid4(), family_id=family_id, list_id=list_id, **fields,
            created_by=user_id, created_at=datetime.now(UTC), version=1,
            request_id=data.request_id, request_fingerprint=digest).on_conflict_do_nothing(
                constraint="shopping_request"))
        row = self.db.scalar(select(ShoppingItem).where(ShoppingItem.family_id == family_id,
                                                       ShoppingItem.request_id == data.request_id))
        if row.request_fingerprint != digest or row.deleted_at is not None:
            raise ShoppingError("این درخواست قبلاً ثبت شده؛ لیست رو تازه کنین و دوباره امتحان کنین.")
        return self.view(row)

    def find_list(self, family_id, list_id):
        row = self.db.scalar(select(ShoppingList).where(ShoppingList.family_id == family_id,
                                                       ShoppingList.id == list_id).with_for_update())
        if row is None:
            raise ShoppingError("این لیست خرید پیدا نشد یا بهش دسترسی ندارین.", 404)
        return row

    def checkout_state(self, family_id, list_id):
        rows = self.db.execute(select(ShoppingItem.id, ShoppingItem.version, ShoppingItem.expense_id)
            .where(ShoppingItem.family_id == family_id, ShoppingItem.list_id == list_id,
                   ShoppingItem.deleted_at.is_(None)).order_by(ShoppingItem.id)).all()
        receipt = self.db.scalar(select(ShoppingCheckout.expense_id).where(
            ShoppingCheckout.family_id == family_id, ShoppingCheckout.list_id == list_id,
            ShoppingCheckout.expense_id.is_not(None)).limit(1))
        token = hashlib.sha256(json.dumps([[str(row.id), row.version] for row in rows]).encode()).hexdigest()
        return {"token": token, "has_expense": receipt is not None or any(row.expense_id for row in rows)}

    def complete_list(self, family_id, user_id, list_id, data):
        self.access.authorize(family_id, user_id)
        shopping_list = self.find_list(family_id, list_id)
        digest = hashlib.sha256(json.dumps({**data.model_dump(mode="json", exclude={"request_id"}),
            "actor": str(user_id)}, sort_keys=True).encode()).hexdigest()
        receipt = self.db.get(ShoppingCheckout, (list_id, data.request_id))
        if receipt is not None:
            if receipt.request_fingerprint != digest:
                raise ShoppingError("این درخواست قبلاً با اطلاعات متفاوت ثبت شده.")
            return {"completed_count": receipt.completed_count,
                    "expense_id": str(receipt.expense_id) if receipt.expense_id else None}
        state = self.checkout_state(family_id, list_id)
        if state["token"] != data.token:
            raise ShoppingError("کالاهای لیست تغییر کردن؛ لیست رو تازه کنین و دوباره تأیید کنین.")
        items = self.db.scalars(select(ShoppingItem).where(ShoppingItem.family_id == family_id,
            ShoppingItem.list_id == list_id, ShoppingItem.deleted_at.is_(None)).order_by(ShoppingItem.id)
            .with_for_update()).all()
        if not items:
            raise ShoppingError("لیست خالیه؛ اول یه کالا اضافه کنین.")
        expense_id = None
        if data.amount_toman is not None:
            if state["has_expense"]:
                raise ShoppingError("برای این لیست یا کالاهاش قبلاً خرج ثبت شده؛ برای جلوگیری از ثبت تکراری، لیست رو بدون مبلغ تکمیل کنین.")
            expense_id = self.expenses.record(family_id=family_id, user_id=user_id,
                item_id=uuid5(list_id, "list-checkout"), name=shopping_list.name,
                quantity="", note="هزینهٔ کل لیست خرید", amount_toman=data.amount_toman,
                category_id=data.category_id)
        now = datetime.now(UTC)
        completed_count = 0
        for item in items:
            changed = False
            if item.purchased_at is None:
                item.purchased_at, item.purchased_by = now, user_id
                completed_count += 1
                changed = True
            if expense_id is not None:
                item.expense_id = expense_id
                changed = True
            if changed:
                item.version += 1
        self.db.add(ShoppingCheckout(list_id=list_id, family_id=family_id, request_id=data.request_id,
            request_fingerprint=digest, expense_id=expense_id, completed_count=completed_count))
        self.db.flush()
        return {"completed_count": completed_count, "expense_id": str(expense_id) if expense_id else None}

    def lists(self, family_id, user_id, offset, status="all"):
        self.access.authorize(family_id, user_id)
        live = (ShoppingItem.family_id == family_id, ShoppingItem.list_id == ShoppingList.id,
                ShoppingItem.deleted_at.is_(None))
        has_items = select(ShoppingItem.id).where(*live).exists()
        has_pending = select(ShoppingItem.id).where(*live, ShoppingItem.purchased_at.is_(None)).exists()
        scope = (ShoppingList.family_id == family_id,)
        if status == "purchased":
            scope += (has_items, ~has_pending)
        elif status == "pending":
            scope += (~has_items | has_pending,)
        rows = self.db.scalars(select(ShoppingList).where(*scope)
            .order_by(ShoppingList.created_at.desc(), ShoppingList.id.desc()).offset(offset).limit(51)).all()
        ids = [row.id for row in rows[:50]]
        counts = {row[0]: (row[1], row[2]) for row in self.db.execute(select(ShoppingItem.list_id,
            func.count().filter(ShoppingItem.purchased_at.is_(None)),
            func.count().filter(ShoppingItem.purchased_at.is_not(None)))
            .where(ShoppingItem.family_id == family_id, ShoppingItem.list_id.in_(ids),
                   ShoppingItem.deleted_at.is_(None)).group_by(ShoppingItem.list_id))}
        return {"lists": [{"id": str(row.id), "name": row.name,
                "pending_count": counts.get(row.id, (0, 0))[0],
                "purchased_count": counts.get(row.id, (0, 0))[1]} for row in rows[:50]],
                "has_more": len(rows) > 50}

    def create_list(self, family_id, user_id, data):
        from app.shopping.schemas import CreateItem

        self.access.authorize(family_id, user_id)
        digest = hashlib.sha256(json.dumps({**data.model_dump(mode="json", exclude={"request_id"}),
            "actor": str(user_id)}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        list_id = self.db.scalar(insert(ShoppingList).values(id=uuid4(), family_id=family_id,
            name=data.name, created_by=user_id, created_at=datetime.now(UTC),
            request_id=data.request_id, request_fingerprint=digest).on_conflict_do_nothing(
                constraint="shopping_list_request").returning(ShoppingList.id))
        row = self.db.scalar(select(ShoppingList).where(ShoppingList.family_id == family_id,
                                                       ShoppingList.request_id == data.request_id))
        if row.request_fingerprint != digest:
            raise ShoppingError("این درخواست قبلاً با اطلاعات متفاوت ثبت شده.")
        if list_id is not None:
            for index, item in enumerate(data.items):
                self.create(family_id, user_id, CreateItem(**item.model_dump(), list_id=list_id,
                    request_id=uuid5(list_id, str(index))))
        return {"id": str(row.id), "name": row.name}

    def find(self, family_id, user_id, item_id):
        self.access.authorize(family_id, user_id)
        list_id = self.db.scalar(select(ShoppingItem.list_id).where(ShoppingItem.family_id == family_id,
                                                                   ShoppingItem.id == item_id))
        if list_id is None:
            raise ShoppingError("این کالا پیدا نشد یا بهش دسترسی ندارین.", 404)
        self.find_list(family_id, list_id)
        row = self.db.scalar(select(ShoppingItem).where(ShoppingItem.family_id == family_id,
            ShoppingItem.id == item_id).with_for_update())
        if row is None:
            raise ShoppingError("این کالا پیدا نشد یا بهش دسترسی ندارین.", 404)
        return row

    @staticmethod
    def require_version(row, version):
        if row.deleted_at is not None:
            raise ShoppingError("این کالا از لیست حذف شده؛ لیست رو تازه کنین.", 404)
        if row.version != version:
            raise ShoppingError("این کالا تغییر کرده؛ لیست رو تازه کنین و تغییرتون رو دوباره انجام بدین.")

    def update(self, family_id, user_id, item_id, data):
        row = self.find(family_id, user_id, item_id)
        self.require_version(row, data.version)
        for field, value in data.model_dump(exclude={"version"}).items():
            setattr(row, field, value)
        row.version += 1
        self.db.flush()
        return self.view(row)

    def set_status(self, family_id, user_id, item_id, data):
        row = self.find(family_id, user_id, item_id)
        self.require_version(row, data.version)
        if data.amount_toman is not None:
            if row.expense_id is not None:
                raise ShoppingError("هزینهٔ این کالا قبلاً ثبت شده؛ بدون مبلغ خرید رو تأیید کنین.")
            if row.purchased_at is not None:
                raise ShoppingError("این کالا قبلاً خریدشده؛ لیست رو تازه کنین.")
            row.expense_id = self.expenses.record(
                family_id=family_id, user_id=user_id, item_id=row.id, name=row.name,
                quantity=row.quantity, note=row.note, amount_toman=data.amount_toman,
                category_id=data.category_id,
            )
        if data.purchased != (row.purchased_at is not None):
            row.purchased_at = datetime.now(UTC) if data.purchased else None
            row.purchased_by = user_id if data.purchased else None
            row.version += 1
        self.db.flush()
        return self.view(row)

    def delete(self, family_id, user_id, item_id, version):
        row = self.find(family_id, user_id, item_id)
        if row.deleted_at is not None:
            return
        self.require_version(row, version)
        row.deleted_at = datetime.now(UTC)
        row.version += 1
        self.db.flush()
