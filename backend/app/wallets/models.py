from datetime import datetime
from typing import ClassVar
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Wallet(Base):
    __tablename__ = "accounts"
    __table_args__ = (CheckConstraint("balance_toman >= 0", name="wallet_nonnegative"), {"schema": "wallets"})
    family_id: Mapped[UUID] = mapped_column(primary_key=True)
    balance_toman: Mapped[int] = mapped_column(BigInteger, server_default="0")


class Entry(Base):
    __tablename__ = "entries"
    __table_args__ = (
        UniqueConstraint("kind", "reference_id", name="wallet_entry_reference"),
        CheckConstraint("(kind IN ('topup', 'sms_refund') AND amount_toman > 0) OR "
                        "(kind = 'signup_gift' AND amount_toman = 5000) OR "
                        "(kind = 'sms' AND amount_toman < 0)", name="wallet_entry_amount"),
        CheckConstraint("balance_after >= 0", name="wallet_entry_balance"),
        Index("ix_wallet_entries_owner", "family_id", "created_at", "id"),
        {"schema": "wallets"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(ForeignKey("wallets.accounts.family_id"))
    kind: Mapped[str] = mapped_column(String(16))
    reference_id: Mapped[UUID] = mapped_column()
    amount_toman: Mapped[int] = mapped_column(BigInteger)
    balance_after: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SignupGift(Base):
    __tablename__ = "signup_gifts"
    __table_args__: ClassVar[dict[str, str]] = {"schema": "wallets"}
    user_id: Mapped[UUID] = mapped_column(primary_key=True)
    family_id: Mapped[UUID | None] = mapped_column(ForeignKey("wallets.accounts.family_id"), nullable=True)


class Topup(Base):
    __tablename__ = "topups"
    __table_args__ = (
        UniqueConstraint("family_id", "request_id", name="wallet_topup_request"),
        CheckConstraint("amount_toman BETWEEN 10000 AND 10000000", name="wallet_topup_amount"),
        CheckConstraint("status IN ('pending', 'paid')", name="wallet_topup_status"),
        Index("ix_wallet_topups_owner", "family_id", "created_at", "id"),
        {"schema": "wallets"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(ForeignKey("wallets.accounts.family_id"))
    actor_user_id: Mapped[UUID | None] = mapped_column(nullable=True)
    request_id: Mapped[UUID] = mapped_column()
    amount_toman: Mapped[int] = mapped_column(BigInteger)
    authority: Mapped[str] = mapped_column(String(64), unique=True)
    reference: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    status: Mapped[str] = mapped_column(String(10), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
