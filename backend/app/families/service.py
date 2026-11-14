import hashlib
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.families.models import Family, Invitation, Membership


class FamilyError(Exception):
    def __init__(self, message: str, status: int = 400):
        self.message, self.status = message, status


def now():
    return datetime.now(UTC)


def lock(db: Session, key: str):
    number = int.from_bytes(hashlib.sha256(("families:" + key).encode()).digest()[:8], signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": number})


def token_digest(token: str):
    return hashlib.sha256(token.encode()).hexdigest()


class Families:
    def __init__(self, db: Session, *,
                 on_member_joined: Callable[[Session, UUID, UUID], None] | None = None):
        self.db = db
        self.on_member_joined = on_member_joined

    def create(self, user_id: UUID, name: str):
        lock(self.db, "member:" + str(user_id))
        if self.db.scalar(select(Family.id).where(Family.owner_id == user_id)):
            raise FamilyError("شما قبلاً خانواده ساختین؛ همون خانواده رو مدیریت کنین.", 409)
        self.check_membership_limit(user_id)
        family = Family(owner_id=user_id, name=name, created_at=now())
        self.db.add(family)
        self.db.flush()
        self.db.add(
            Membership(
                family_id=family.id, user_id=user_id, relationship=None, joined_at=now()
            )
        )
        self.db.flush()
        if self.on_member_joined:
            self.on_member_joined(self.db, user_id, family.id)
        return self.summary(family)

    def check_membership_limit(self, user_id):
        count = self.db.scalar(
            select(func.count()).select_from(Membership).where(Membership.user_id == user_id)
        )
        if count >= 20:
            raise FamilyError("به سقف عضویت در خانواده‌ها رسیدین.", 409)

    def summary(self, family):
        return {
            "id": str(family.id),
            "name": family.name,
            "owner_id": str(family.owner_id),
            "created_at": family.created_at.isoformat(),
        }

    def list(self, user_id):
        rows = self.db.scalars(
            select(Family)
            .join(Membership)
            .where(Membership.user_id == user_id)
            .order_by(Family.created_at, Family.id)
        )
        return [self.summary(row) for row in rows]

    def require_member(self, family_id, user_id):
        family = self.db.get(Family, family_id)
        member = self.db.scalar(
            select(Membership).where(Membership.family_id == family_id, Membership.user_id == user_id)
        )
        if not family or not member:
            raise FamilyError("خانواده پیدا نشد یا بهش دسترسی ندارین.", 404)
        return family

    def require_owner(self, family_id, user_id):
        family = self.require_member(family_id, user_id)
        if family.owner_id != user_id:
            raise FamilyError("بخش مدیریت فقط برای سازندهٔ خانواده است.", 403)
        return family

    def detail(self, family_id, user_id):
        family = self.require_member(family_id, user_id)
        members = self.db.scalars(
            select(Membership)
            .where(Membership.family_id == family_id)
            .order_by(Membership.joined_at, Membership.id)
        ).all()
        return self.summary(family), [
            {
                "user_id": str(m.user_id),
                "relationship": m.relationship,
                "joined_at": m.joined_at.isoformat(),
            }
            for m in members
        ]

    def invitation_view(self, invite):
        status = (
            "accepted"
            if invite.accepted_at
            else "revoked"
            if invite.revoked_at
            else "expired"
            if invite.expires_at <= now()
            else "pending"
        )
        return {
            "id": str(invite.id),
            "relationship": invite.relationship,
            "status": status,
            "expires_at": invite.expires_at.isoformat(),
        }

    def invite(self, family_id, user_id, relationship):
        lock(self.db, "family:" + str(family_id))
        self.require_member(family_id, user_id)
        recent = self.db.scalar(
            select(func.count())
            .select_from(Invitation)
            .where(Invitation.family_id == family_id, Invitation.created_at > now() - timedelta(hours=1))
        )
        if recent >= 20:
            raise FamilyError("تعداد دعوت‌ها زیاده؛ یک ساعت بعد دوباره امتحان کنین.", 429)
        count = self.db.scalar(
            select(func.count()).select_from(Membership).where(Membership.family_id == family_id)
        )
        if count >= 100:
            raise FamilyError("ظرفیت این خانواده تکمیل شده.", 409)
        token = secrets.token_urlsafe(32)
        invite = Invitation(
            family_id=family_id,
            token_hash=token_digest(token),
            relationship=relationship,
            created_at=now(),
            expires_at=now() + timedelta(days=7),
        )
        self.db.add(invite)
        self.db.flush()
        return {"invitation": self.invitation_view(invite), "token": token}

    def invitations(self, family_id, user_id):
        self.require_member(family_id, user_id)
        rows = self.db.scalars(
            select(Invitation)
            .where(Invitation.family_id == family_id)
            .order_by(Invitation.created_at.desc())
            .limit(100)
        )
        return [self.invitation_view(row) for row in rows]

    def revoke(self, family_id, invite_id, user_id):
        lock(self.db, "family:" + str(family_id))
        self.require_member(family_id, user_id)
        invite = self.db.get(Invitation, invite_id)
        if not invite or invite.family_id != family_id:
            raise FamilyError("دعوت پیدا نشد.", 404)
        if invite.accepted_at:
            raise FamilyError("این دعوت قبلاً پذیرفته شده.", 409)
        invite.revoked_at = now()

    def resolve(self, token):
        invite = self.db.scalar(select(Invitation).where(Invitation.token_hash == token_digest(token)))
        if not invite:
            raise FamilyError("لینک دعوت معتبر نیست.", 404)
        lock(self.db, "family:" + str(invite.family_id))
        self.db.refresh(invite)
        if invite.revoked_at or invite.expires_at <= now():
            raise FamilyError("این دعوت لغو شده یا اعتبارش تموم شده؛ از سازنده لینک تازه بگیرین.", 410)
        return invite

    def preview(self, token, user_id):
        invite = self.resolve(token)
        if invite.accepted_at and invite.accepted_by != user_id:
            raise FamilyError("این دعوت قبلاً استفاده شده.", 409)
        family = self.db.get(Family, invite.family_id)
        return {
            "family": self.summary(family),
            "relationship": invite.relationship,
            "expires_at": invite.expires_at.isoformat(),
            "accepted": invite.accepted_by == user_id,
        }

    def accept(self, token, user_id):
        # Always lock member before family, also used by creation.
        lock(self.db, "member:" + str(user_id))
        invite = self.resolve(token)
        if invite.accepted_at:
            if invite.accepted_by == user_id:
                return {"family_id": str(invite.family_id)}
            raise FamilyError("این دعوت قبلاً استفاده شده.", 409)
        if self.db.scalar(
            select(Membership.id).where(
                Membership.family_id == invite.family_id, Membership.user_id == user_id
            )
        ):
            raise FamilyError("شما از قبل عضو این خانواده هستین.", 409)
        self.check_membership_limit(user_id)
        count = self.db.scalar(
            select(func.count()).select_from(Membership).where(Membership.family_id == invite.family_id)
        )
        if count >= 100:
            raise FamilyError("ظرفیت این خانواده تکمیل شده.", 409)
        self.db.add(
            Membership(
                family_id=invite.family_id,
                user_id=user_id,
                relationship=invite.relationship,
                joined_at=now(),
            )
        )
        invite.accepted_at, invite.accepted_by = now(), user_id
        self.db.flush()
        if self.on_member_joined:
            self.on_member_joined(self.db, user_id, invite.family_id)
        return {"family_id": str(invite.family_id)}
