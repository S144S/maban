from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Plant(Base):
    __tablename__ = "plants"
    __table_args__ = (
        UniqueConstraint("family_id", "request_id", name="plants_request"),
        CheckConstraint("soil_interval BETWEEN 1 AND 365", name="plants_soil_interval"),
        CheckConstraint("(fertilizer_interval IS NULL AND fertilizer_due IS NULL) OR "
                        "(fertilizer_interval IS NOT NULL AND fertilizer_interval BETWEEN 1 AND 365 "
                        "AND fertilizer_due IS NOT NULL)",
                        name="plants_fertilizer_schedule"),
        Index("ix_plants_family", "family_id", "deleted_at", "id"),
        Index("ix_plants_photo_key", "photo_key", unique=True),
        CheckConstraint("(photo_digest IS NULL AND photo_key IS NULL) OR "
                        "(photo_digest IS NOT NULL AND photo_key IS NOT NULL)", name="plants_photo"),
        {"schema": "plants"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column()
    name: Mapped[str] = mapped_column(String(80))
    species: Mapped[str] = mapped_column(String(120))
    location: Mapped[str] = mapped_column(String(120))
    note: Mapped[str] = mapped_column(String(2000))
    assignee_id: Mapped[UUID | None] = mapped_column(nullable=True)
    soil_interval: Mapped[int] = mapped_column()
    soil_due: Mapped[date] = mapped_column(Date)
    fertilizer_interval: Mapped[int | None] = mapped_column(nullable=True)
    fertilizer_due: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[UUID] = mapped_column()
    request_id: Mapped[UUID] = mapped_column()
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    photo_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    photo_key: Mapped[str | None] = mapped_column(String(200), nullable=True)


class CareEvent(Base):
    __tablename__ = "care_events"
    __table_args__ = (
        UniqueConstraint("family_id", "request_id", name="plants_care_request"),
        CheckConstraint("action IN ('watered', 'not_needed', 'fertilized')", name="plants_care_action"),
        Index("ix_plants_history", "plant_id", "performed_at", "id"),
        {"schema": "plants"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column()
    plant_id: Mapped[UUID] = mapped_column(ForeignKey("plants.plants.id"))
    actor_id: Mapped[UUID] = mapped_column()
    action: Mapped[str] = mapped_column(String(16))
    note: Mapped[str] = mapped_column(String(2000))
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    next_due: Mapped[date] = mapped_column(Date)
    request_id: Mapped[UUID] = mapped_column()
    request_fingerprint: Mapped[str] = mapped_column(String(64))
