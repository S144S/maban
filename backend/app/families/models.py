from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Family(Base):
    __tablename__ = "families"
    __table_args__ = ({"schema": "families"},)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(unique=True)
    name: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("family_id", "user_id"),
        CheckConstraint("access IN ('full', 'view')", name="membership_access"),
        CheckConstraint(
            "relationship IN ('spouse', 'child', 'friend') OR relationship IS NULL",
            name="membership_relationship",
        ),
        Index("ix_family_members_user", "user_id"),
        {"schema": "families"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(ForeignKey("families.families.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column()
    access: Mapped[str] = mapped_column(String(4), default="view", server_default="view")
    relationship: Mapped[str | None] = mapped_column(String(10))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint("access IN ('full', 'view')", name="invitation_access"),
        CheckConstraint("relationship IN ('spouse', 'child', 'friend')", name="invitation_relationship"),
        Index("ix_family_invites_family_created", "family_id", "created_at"),
        {"schema": "families"},
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(ForeignKey("families.families.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    access: Mapped[str] = mapped_column(String(4), default="view", server_default="view")
    relationship: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_by: Mapped[UUID | None] = mapped_column()
