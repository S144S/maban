from datetime import UTC, datetime
from decimal import Decimal, localcontext
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.investments.models import Investment


class InvestmentError(Exception):
    def __init__(self, message: str):
        self.message = message


class Investments:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def view(row):
        amount = row.shares if row.kind == "stock" else row.grams if row.kind == "silver" else row.quantity
        total = None
        if amount is not None and row.unit_price_toman is not None:
            with localcontext() as context:
                context.prec = 60
                total = format(Decimal(amount) * row.unit_price_toman, "f")
        return {"id": str(row.id), "kind": row.kind, "grams": str(row.grams) if row.grams is not None else None,
                "symbol": row.symbol, "shares": row.shares,
                "quantity": format(row.quantity, "f") if row.quantity is not None else None,
                "calculated_total_toman": total,
                "unit_price_toman": row.unit_price_toman, "total_price_toman": row.total_price_toman,
                "description": row.description, "created_at": row.created_at.isoformat()}

    def create(self, user_id, data):
        values = {**data.model_dump(), "user_id": user_id, "description": data.description or None}
        self.db.execute(insert(Investment).values(id=uuid4(), created_at=datetime.now(UTC), **values)
                        .on_conflict_do_nothing(constraint="investment_request"))
        row = self.db.scalar(select(Investment).where(
            Investment.user_id == user_id, Investment.request_id == data.request_id))
        if any(getattr(row, key) != value for key, value in values.items()):
            raise InvestmentError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
        return self.view(row)

    def list(self, user_id, offset):
        rows = self.db.scalars(select(Investment).where(Investment.user_id == user_id)
                               .order_by(Investment.created_at.desc(), Investment.id.desc())
                               .offset(offset).limit(50)).all()
        count = self.db.scalar(select(func.count()).select_from(Investment).where(Investment.user_id == user_id))
        return {"entries": [self.view(row) for row in rows], "count": count, "offset": offset}
