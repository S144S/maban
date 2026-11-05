from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Reminder(Base):
    __tablename__ = "entries"
    __table_args__ = (
        UniqueConstraint("user_id", "request_id", name="reminder_request"),
        CheckConstraint("recurrence IN ('none', 'daily', 'weekly', 'monthly')", name="reminder_recurrence"),
        CheckConstraint("amount_toman IS NULL OR (amount_toman > 0 AND amount_toman <= 1000000000000)",
                        name="reminder_amount"),
        Index("ix_reminders_user_due", "user_id", "due_at", "id"),
        Index("ix_reminders_next_sms", "next_sms_at", "id"),
        CheckConstraint("sms_status IN ('pending', 'accepted', 'unknown', 'skipped')", name="reminder_sms_status"),
        {"schema": "reminders"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column()
    title: Mapped[str] = mapped_column(String(80))
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recurrence: Mapped[str] = mapped_column(String(7), server_default="none")
    amount_toman: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    request_id: Mapped[UUID] = mapped_column()
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_sms_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sms_revision: Mapped[int] = mapped_column(server_default="0")
    sms_status: Mapped[str] = mapped_column(String(10), server_default="pending")


class SmsAttempt(Base):
    """An occurrence is reserved durably before contacting the provider."""

    __tablename__ = "sms_attempts"
    __table_args__ = (
        UniqueConstraint("reminder_id", "revision", "due_at", name="reminder_sms_occurrence"),
        CheckConstraint("status IN ('accepted', 'unknown', 'skipped')", name="reminder_attempt_status"),
        {"schema": "reminders"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    reminder_id: Mapped[UUID] = mapped_column()
    revision: Mapped[int] = mapped_column()
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10))
