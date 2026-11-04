from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class IncomeEntry(Base):
    __tablename__ = "entries"
    __table_args__ = (
        CheckConstraint("amount_toman > 0 AND amount_toman <= 1000000000000", name="income_amount"),
        CheckConstraint("source IN ('salary', 'subsidy', 'voucher', 'gift')", name="income_source"),
        UniqueConstraint("family_id", "request_id", name="income_request"),
        {"schema": "income"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(index=True)
    amount_toman: Mapped[int] = mapped_column(BigInteger)
    source: Mapped[str] = mapped_column(String(16))
    from_member_id: Mapped[UUID] = mapped_column()
    description: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[UUID] = mapped_column()
    request_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
