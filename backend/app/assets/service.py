from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Numeric, case, cast, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.assets.models import Asset, AssetSnapshot
from app.valuation_history import capture, lock_history, report_history


class AssetError(Exception):
    def __init__(self, message: str):
        self.message = message


class Assets:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def view(row):
        return {"id": str(row.id), "kind": row.kind, "title": row.title, "location": row.location,
                "area_sqm": str(row.area_sqm) if row.area_sqm is not None else None,
                "brand": row.brand, "model": row.model, "manufacture_year": row.manufacture_year,
                "year_calendar": row.year_calendar, "purchase_price_toman": row.purchase_price_toman,
                "price_per_sqm_toman": row.price_per_sqm_toman,
                "description": row.description, "created_at": row.created_at.isoformat()}

    def create(self, user_id, data):
        self.begin_history(user_id)
        values = {**data.model_dump(), "user_id": user_id, "description": data.description or None}
        self.db.execute(insert(Asset).values(id=uuid4(), created_at=datetime.now(UTC), **values)
                        .on_conflict_do_nothing(constraint="asset_request"))
        row = self.db.scalar(select(Asset).where(
            Asset.user_id == user_id, Asset.request_id == data.request_id))
        if any(getattr(row, key) != value for key, value in values.items()):
            raise AssetError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
        self.snapshot(user_id)
        return self.view(row)

    def list(self, user_id, offset):
        rows = self.db.scalars(select(Asset).where(Asset.user_id == user_id)
                               .order_by(Asset.created_at.desc(), Asset.id.desc())
                               .offset(offset).limit(50)).all()
        count = self.db.scalar(select(func.count()).select_from(Asset).where(Asset.user_id == user_id))
        return {"entries": [self.view(row) for row in rows], "count": count, "offset": offset}


    def summary(self, user_id):
        value = case(
            (Asset.price_per_sqm_toman.is_not(None), Asset.area_sqm * cast(Asset.price_per_sqm_toman, Numeric)),
            else_=cast(Asset.purchase_price_toman, Numeric),
        )
        count, priced_count, total = self.db.execute(
            select(func.count(), func.count(value), func.coalesce(func.sum(value), 0))
            .select_from(Asset).where(Asset.user_id == user_id)
        ).one()
        return {"total_toman": format(total, "f"), "count": count,
                "unpriced_count": count - priced_count, "valuation_basis": "recorded_purchase_prices"}


    def rates(self, user_id):
        rows = self.db.scalars(select(Asset).where(Asset.user_id == user_id)
                               .order_by(Asset.kind, Asset.created_at, Asset.id)).all()
        return {"entries": [{**self.view(row), "unit_price_toman": row.current_unit_price_toman}
                            for row in rows]}

    def set_rate(self, user_id, asset_id, data):
        self.begin_history(user_id)
        row = self.db.scalar(select(Asset).where(Asset.user_id == user_id, Asset.id == asset_id)
                             .with_for_update())
        if row is None:
            raise AssetError("این دارایی در صندوق شما پیدا نشد.")
        row.current_unit_price_toman = data.unit_price_toman
        row.rate_updated_at = datetime.now(UTC) if data.unit_price_toman is not None else None
        self.db.flush()
        self.snapshot(user_id)

    def current_summary(self, user_id):
        value = case((Asset.kind == "car", cast(Asset.current_unit_price_toman, Numeric)),
                     else_=Asset.area_sqm * cast(Asset.current_unit_price_toman, Numeric))
        count, priced_count, total = self.db.execute(
            select(func.count(), func.count(value), func.coalesce(func.sum(value), 0))
            .select_from(Asset).where(Asset.user_id == user_id)
        ).one()
        return {"total_toman": format(total, "f"), "count": count,
                "unpriced_count": count - priced_count, "valuation_basis": "manual_unit_rates"}

    def history_holdings(self, user_id):
        rows = self.db.scalars(select(Asset).where(Asset.user_id == user_id).order_by(Asset.id)).all()
        return [{"id": str(r.id), "kind": r.kind, "label": r.model if r.kind == "car" else r.title,
                 "quantity": "1" if r.kind == "car" else str(r.area_sqm),
                 "price": str(r.current_unit_price_toman) if r.current_unit_price_toman is not None else None} for r in rows]

    def begin_history(self, user_id):
        lock_history(self.db, "assets", user_id)
        self.snapshot(user_id)

    def snapshot(self, user_id):
        capture(self.db, AssetSnapshot, user_id, self.history_holdings(user_id))

    def report(self, user_id, start, end):
        return report_history(self.db, AssetSnapshot, user_id, start, end)
