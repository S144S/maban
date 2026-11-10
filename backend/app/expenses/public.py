"""Expense writing contract bound to a caller-owned transaction.

Only composition code supplies the session; callers receive an opaque expense ID.
"""

from uuid import UUID, uuid5

from app.expenses.schemas import CreateExpense
from app.expenses.service import Expense


class PurchaseExpenses:
    def __init__(self, session, access):
        self._service = Expense(session, access)

    def record(self, *, family_id, user_id, item_id, name, quantity, note, amount_toman, category_id) -> UUID:
        service = self._service
        service.access.authorize(family_id, user_id)
        if category_id is None:
            service.lock_categories(family_id)
            category_id = service.ensure_default(family_id, user_id).id
        result = service.create(family_id, user_id, CreateExpense(
            amount_toman=amount_toman, category_id=category_id, paid_by_member_id=user_id,
            title=name[:80], description=" · ".join(value for value in (name, quantity, note) if value)[:500],
            request_id=uuid5(item_id, "shopping-expense"),
        ))
        return UUID(result["id"])
