from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Investment(Base):
    __tablename__ = "entries"
    __table_args__ = (
        CheckConstraint("kind IN ('gold', 'stock', 'silver', 'crypto', 'currency', 'bond')", name="investment_kind"),
        CheckConstraint("grams > 0 AND grams <= 1000000", name="investment_grams"),
        CheckConstraint("unit_price_toman > 0 AND unit_price_toman <= 1000000000000", name="investment_unit_price"),
        CheckConstraint("total_price_toman > 0 AND total_price_toman <= 1000000000000", name="investment_total_price"),
        CheckConstraint("((kind IN ('gold', 'silver') AND grams IS NOT NULL AND symbol IS NULL AND shares IS NULL AND quantity IS NULL AND (kind = 'gold' OR total_price_toman IS NULL)) OR (kind = 'stock' AND grams IS NULL AND symbol IS NOT NULL AND length(trim(symbol)) > 0 AND shares IS NOT NULL AND shares > 0 AND shares <= 1000000000 AND total_price_toman IS NULL AND quantity IS NULL) OR (kind IN ('crypto', 'currency', 'bond') AND grams IS NULL AND shares IS NULL AND symbol IS NOT NULL AND length(trim(symbol)) > 0 AND quantity IS NOT NULL AND quantity > 0 AND quantity <= 1000000000 AND total_price_toman IS NULL AND (kind != 'bond' OR quantity = trunc(quantity)) AND (kind != 'currency' OR quantity = trunc(quantity, 2))))", name="investment_fields"),
        UniqueConstraint("user_id", "request_id", name="investment_request"),
        {"schema": "investments"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True)
    kind: Mapped[str] = mapped_column(String(16))
    grams: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    symbol: Mapped[str | None] = mapped_column(String(40))
    shares: Mapped[int | None] = mapped_column(BigInteger)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(28, 18))
    unit_price_toman: Mapped[int | None] = mapped_column(BigInteger)
    total_price_toman: Mapped[int | None] = mapped_column(BigInteger)
    description: Mapped[str | None] = mapped_column(String(500))
    request_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
