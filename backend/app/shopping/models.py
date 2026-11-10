from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKeyConstraint, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ShoppingList(Base):
    __tablename__ = "lists"
    __table_args__ = (
        UniqueConstraint("family_id", "id", name="shopping_list_family"),
        UniqueConstraint("family_id", "request_id", name="shopping_list_request"),
        CheckConstraint("length(trim(name)) > 0", name="shopping_list_name"),
        {"schema": "shopping"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column()
    name: Mapped[str] = mapped_column(String(120))
    created_by: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    request_id: Mapped[UUID] = mapped_column()
    request_fingerprint: Mapped[str] = mapped_column(String(64))


class ShoppingItem(Base):
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("family_id", "request_id", name="shopping_request"),
        ForeignKeyConstraint(["family_id", "list_id"], ["shopping.lists.family_id", "shopping.lists.id"], name="shopping_item_list"),
        Index("ix_shopping_list", "list_id", "deleted_at", "purchased_at"),
        CheckConstraint("version > 0", name="shopping_version"),
        CheckConstraint("length(trim(name)) > 0", name="shopping_name"),
        CheckConstraint("(purchased_at IS NULL) = (purchased_by IS NULL)", name="shopping_purchase"),
        Index("ix_shopping_family", "family_id", "deleted_at", "purchased_at", "created_at", "id"),
        {"schema": "shopping"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column()
    list_id: Mapped[UUID] = mapped_column()
    name: Mapped[str] = mapped_column(String(120))
    quantity: Mapped[str] = mapped_column(String(80))
    note: Mapped[str] = mapped_column(String(500))
    created_by: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    purchased_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    purchased_by: Mapped[UUID | None] = mapped_column()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(default=1)
    request_id: Mapped[UUID] = mapped_column()
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    expense_id: Mapped[UUID | None] = mapped_column()


class ShoppingCheckout(Base):
    __tablename__ = "checkouts"
    __table_args__ = (
        ForeignKeyConstraint(["family_id", "list_id"], ["shopping.lists.family_id", "shopping.lists.id"], name="shopping_checkout_list"),
        CheckConstraint("completed_count >= 0", name="shopping_checkout_count"),
        {"schema": "shopping"},
    )
    list_id: Mapped[UUID] = mapped_column(primary_key=True)
    request_id: Mapped[UUID] = mapped_column(primary_key=True)
    family_id: Mapped[UUID] = mapped_column()
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    expense_id: Mapped[UUID | None] = mapped_column()
    completed_count: Mapped[int] = mapped_column()
