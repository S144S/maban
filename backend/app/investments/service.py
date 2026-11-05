from datetime import UTC, datetime
from decimal import Decimal, localcontext
from uuid import uuid4

from sqlalchemy import Numeric, case, cast, delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.investments.models import Investment, InvestmentRate


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


    def summary(self, user_id):
        value = case(
            (Investment.total_price_toman.is_not(None), cast(Investment.total_price_toman, Numeric)),
            else_=func.coalesce(cast(Investment.shares, Numeric), Investment.grams, Investment.quantity)
                  * cast(Investment.unit_price_toman, Numeric),
        )
        count, priced_count, total = self.db.execute(
            select(func.count(), func.count(value), func.coalesce(func.sum(value), 0))
            .select_from(Investment).where(Investment.user_id == user_id)
        ).one()
        return {"total_toman": format(total, "f"), "count": count,
                "unpriced_count": count - priced_count, "valuation_basis": "recorded_purchase_prices"}

    def set_rate(self, user_id, data):
        symbol = func.coalesce(Investment.symbol, "")
        owned = self.db.scalar(select(Investment.id).where(
            Investment.user_id == user_id, Investment.kind == data.kind,
            symbol == data.symbol).limit(1))
        if owned is None:
            raise InvestmentError("اول این سرمایه رو به صندوق خودتون اضافه کنین.")
        if data.unit_price_toman is None:
            self.db.execute(delete(InvestmentRate).where(
                InvestmentRate.user_id == user_id, InvestmentRate.kind == data.kind,
                InvestmentRate.symbol == data.symbol))
            return
        values = {**data.model_dump(), "user_id": user_id, "updated_at": datetime.now(UTC)}
        self.db.execute(insert(InvestmentRate).values(**values).on_conflict_do_update(
            index_elements=["user_id", "kind", "symbol"],
            set_={"unit_price_toman": data.unit_price_toman, "updated_at": values["updated_at"]}))

    def rates(self, user_id):
        # Aggregate every holding, independently of the paginated transaction list.
        symbol = func.coalesce(Investment.symbol, "")
        amount = func.coalesce(cast(Investment.shares, Numeric), Investment.grams, Investment.quantity)
        holdings = self.db.execute(select(Investment.kind, symbol.label("symbol"),
            func.sum(amount).label("quantity"), func.count().label("count"))
            .where(Investment.user_id == user_id).group_by(Investment.kind, symbol)
            .order_by(Investment.kind, symbol)).all()
        prices = {(r.kind, r.symbol): r for r in self.db.scalars(
            select(InvestmentRate).where(InvestmentRate.user_id == user_id))}
        entries, count, missing = [], 0, 0
        with localcontext() as context:
            context.prec = 80
            total = Decimal(0)
            for holding in holdings:
                rate = prices.get((holding.kind, holding.symbol))
                value = holding.quantity * rate.unit_price_toman if rate else None
                count += holding.count
                if value is None:
                    missing += holding.count
                else:
                    total += value
                entries.append({"kind": holding.kind, "symbol": holding.symbol,
                    "quantity": format(holding.quantity, "f"), "count": holding.count,
                    "unit_price_toman": rate.unit_price_toman if rate else None,
                    "updated_at": rate.updated_at.isoformat() if rate else None,
                    "value_toman": format(value, "f") if value is not None else None})
        return {"entries": entries, "summary": {"total_toman": format(total, "f"),
            "count": count, "unpriced_count": missing, "valuation_basis": "manual_unit_rates"}}
