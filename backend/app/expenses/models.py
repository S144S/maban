from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExpenseEntry(Base):
    __tablename__ = "entries"
    __table_args__ = (
        CheckConstraint("amount_toman > 0 AND amount_toman <= 1000000000000", name="expenses_amount"),
        CheckConstraint("category IN ('home', 'groceries', 'leisure', 'other')", name="expenses_category"),
        UniqueConstraint("family_id", "request_id", name="expenses_request"),
        {"schema": "expenses"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(index=True)
    amount_toman: Mapped[int] = mapped_column(BigInteger)
    category: Mapped[str] = mapped_column(String(16))
    category_id: Mapped[UUID | None] = mapped_column()
    submitted_category_id: Mapped[UUID | None] = mapped_column()
    category_name: Mapped[str | None] = mapped_column(String(80))
    paid_by_member_id: Mapped[UUID] = mapped_column()
    title: Mapped[str] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[UUID] = mapped_column()
    request_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ExpenseCategory(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("family_id", "name", name="expense_category_name"),
        UniqueConstraint("family_id", "request_id", name="expense_category_request"),
        {"schema": "expenses"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(index=True)
    icon: Mapped[str] = mapped_column(String(32), default="tag", server_default="tag")
    name: Mapped[str] = mapped_column(String(80))
    created_by: Mapped[UUID] = mapped_column()
    request_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
