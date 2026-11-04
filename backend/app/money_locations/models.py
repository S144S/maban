from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MoneyLocation(Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("family_id", "name", name="location_family_name"),
        UniqueConstraint("family_id", "request_id", name="location_request"),
        {"schema": "money_locations"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(80))
    created_by: Mapped[UUID] = mapped_column()
    request_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
