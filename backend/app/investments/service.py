from datetime import UTC, datetime
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
        return {"id": str(row.id), "kind": row.kind, "grams": str(row.grams),
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
