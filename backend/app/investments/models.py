from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Investment(Base):
    __tablename__ = "entries"
    __table_args__ = (
        CheckConstraint("kind = 'gold'", name="investment_kind"),
        CheckConstraint("grams > 0 AND grams <= 1000000", name="investment_grams"),
        CheckConstraint("unit_price_toman > 0 AND unit_price_toman <= 1000000000000", name="investment_unit_price"),
        CheckConstraint("total_price_toman > 0 AND total_price_toman <= 1000000000000", name="investment_total_price"),
        UniqueConstraint("user_id", "request_id", name="investment_request"),
        {"schema": "investments"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True)
    kind: Mapped[str] = mapped_column(String(16))
    grams: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    unit_price_toman: Mapped[int | None] = mapped_column(BigInteger)
    total_price_toman: Mapped[int | None] = mapped_column(BigInteger)
    description: Mapped[str | None] = mapped_column(String(500))
    request_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
