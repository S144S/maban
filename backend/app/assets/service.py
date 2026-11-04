from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.assets.models import Asset


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
        values = {**data.model_dump(), "user_id": user_id, "description": data.description or None}
        self.db.execute(insert(Asset).values(id=uuid4(), created_at=datetime.now(UTC), **values)
                        .on_conflict_do_nothing(constraint="asset_request"))
        row = self.db.scalar(select(Asset).where(
            Asset.user_id == user_id, Asset.request_id == data.request_id))
        if any(getattr(row, key) != value for key, value in values.items()):
            raise AssetError("این درخواست قبلاً با اطلاعات دیگه ثبت شده؛ فرم رو دوباره باز کنین.")
        return self.view(row)

    def list(self, user_id, offset):
        rows = self.db.scalars(select(Asset).where(Asset.user_id == user_id)
                               .order_by(Asset.created_at.desc(), Asset.id.desc())
                               .offset(offset).limit(50)).all()
        count = self.db.scalar(select(func.count()).select_from(Asset).where(Asset.user_id == user_id))
        return {"entries": [self.view(row) for row in rows], "count": count, "offset": offset}
