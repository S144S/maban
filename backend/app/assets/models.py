from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Asset(Base):
    __tablename__ = "entries"
    __table_args__ = (
        CheckConstraint("kind IN ('house', 'land', 'car')", name="asset_kind"),
        CheckConstraint("(kind IN ('house', 'land') AND title IS NOT NULL AND length(trim(title)) > 0 AND location IS NOT NULL AND length(trim(location)) > 0 AND area_sqm IS NOT NULL AND area_sqm > 0 AND area_sqm <= 1000000000 AND brand IS NULL AND model IS NULL AND manufacture_year IS NULL AND year_calendar IS NULL) OR (kind = 'car' AND title IS NULL AND location IS NULL AND area_sqm IS NULL AND (brand IS NULL OR length(trim(brand)) > 0) AND model IS NOT NULL AND length(trim(model)) > 0 AND manufacture_year IS NOT NULL AND year_calendar IS NOT NULL AND ((year_calendar = 'solar' AND manufacture_year BETWEEN 1200 AND 1500) OR (year_calendar = 'gregorian' AND manufacture_year BETWEEN 1886 AND 2100)))", name="asset_fields"),
        CheckConstraint("purchase_price_toman > 0 AND purchase_price_toman <= 1000000000000", name="asset_price"),
        CheckConstraint("price_per_sqm_toman IS NULL OR (kind IN ('house', 'land') AND price_per_sqm_toman > 0 AND price_per_sqm_toman <= 1000000000000)", name="asset_sqm_price"),
        CheckConstraint("current_unit_price_toman IS NULL OR (current_unit_price_toman > 0 AND current_unit_price_toman <= 1000000000000)", name="asset_current_price"),
        UniqueConstraint("user_id", "request_id", name="asset_request"),
        {"schema": "assets"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True)
    kind: Mapped[str] = mapped_column(String(16))
    title: Mapped[str | None] = mapped_column(String(80))
    location: Mapped[str | None] = mapped_column(String(200))
    area_sqm: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    brand: Mapped[str | None] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(80))
    manufacture_year: Mapped[int | None] = mapped_column(Integer)
    year_calendar: Mapped[str | None] = mapped_column(String(16))
    price_per_sqm_toman: Mapped[int | None] = mapped_column(BigInteger)
    purchase_price_toman: Mapped[int | None] = mapped_column(BigInteger)
    description: Mapped[str | None] = mapped_column(String(500))
    request_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    current_unit_price_toman: Mapped[int | None] = mapped_column(BigInteger)
    rate_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AssetSnapshot(Base):
    __tablename__ = "valuation_history"
    __table_args__ = ({"schema": "assets"},)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[UUID] = mapped_column(index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    holdings: Mapped[list] = mapped_column(JSONB)
