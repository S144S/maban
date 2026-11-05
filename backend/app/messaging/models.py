from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SmsJob(Base):
    __tablename__ = "sms_jobs"
    __table_args__ = (
        UniqueConstraint("kind", "reference_id", name="sms_job_reference"),
        CheckConstraint("status IN ('pending', 'processing', 'accepted', 'failed', 'unknown', 'skipped')",
                        name="sms_job_status"),
        Index("ix_sms_jobs_ready", "status", "priority", "available_at", "id"),
        Index("ix_sms_jobs_claimed", "status", "claimed_at"),
        {"schema": "messaging"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(String(32))
    reference_id: Mapped[UUID] = mapped_column()
    priority: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(10), default="pending")
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    encrypted_payload: Mapped[str | None] = mapped_column(Text)
