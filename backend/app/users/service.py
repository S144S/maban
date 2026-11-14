import hashlib
import hmac
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.orm import Session

from app.config import Settings
from app.messaging.public import enqueue_sms
from app.users.models import LoginSession, OtpChallenge, RateBucket, User
from app.users.security import digest, dummy_hash, password_hasher, password_matches


class UserError(Exception):
    def __init__(self, message: str, status: int = 400, retry_after: int | None = None):
        self.message, self.status, self.retry_after = message, status, retry_after


def utcnow():
    return datetime.now(UTC)


def lock(db: Session, key: str):
    number = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": number})


def user_view(user: User):
    return {
        "id": str(user.id),
        "phone": user.phone,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "active": user.active,
        "created_at": user.created_at.isoformat(),
    }


class Users:
    def __init__(self, db: Session, settings: Settings, *,
                 on_registered: Callable[[Session, UUID], None] | None = None):
        self.db, self.settings = db, settings
        self.on_registered = on_registered

    def hash(self, value: str):
        return digest(self.settings.secret_key, value)

    def throttle(self, key: str, maximum: int, seconds: int = 900):
        key = self.hash(key)
        lock(self.db, "rate:" + key)
        bucket = self.db.get(RateBucket, key)
        now = utcnow()
        if not bucket:
            bucket = RateBucket(key=key, count=0, expires_at=now + timedelta(seconds=seconds))
            self.db.add(bucket)
        elif bucket.expires_at <= now:
            bucket.count, bucket.expires_at = 0, now + timedelta(seconds=seconds)
        if bucket.count >= maximum:
            raise UserError(
                "تعداد درخواست‌ها زیاده؛ کمی بعد دوباره امتحان کنین.",
                429,
                max(1, int((bucket.expires_at - now).total_seconds())),
            )
        bucket.count += 1
        self.db.flush()

    def by_phone(self, phone: str):
        return self.db.scalar(select(User).where(User.phone == phone))

    @staticmethod
    def notification_phone(db: Session, user_id: UUID) -> str | None:
        return db.scalar(select(User.phone).where(User.id == user_id, User.active.is_(True)))

    def request_otp(self, phone: str, purpose: str, ip: str):
        self.throttle("otp-ip:" + ip, 30)
        self.throttle("otp-phone:" + phone, 5)
        lock(self.db, "phone:" + phone)
        user = self.by_phone(phone)
        eligible = user is None if purpose == "signup" else user is not None and user.active
        if purpose == "login" and not eligible:
            raise UserError(
                "برای این شماره حساب فعالی پیدا نشد. اگه هنوز ثبت‌نام نکردین، از صفحهٔ ثبت‌نام حساب بسازین.",
                400,
            )
        now = utcnow()
        recent = self.db.scalar(
            select(OtpChallenge)
            .where(OtpChallenge.phone == phone)
            .order_by(OtpChallenge.created_at.desc())
            .limit(1)
        )
        if recent and (now - recent.created_at).total_seconds() < 30:
            raise UserError(
                "برای دریافت دوبارهٔ کد کمی صبر کنین.",
                429,
                max(1, 30 - int((now - recent.created_at).total_seconds())),
            )
        code = "12345" if self.settings.development_otp else f"{secrets.randbelow(100000):05d}"
        challenge_id = uuid4()
        self.db.execute(
            update(OtpChallenge).where(OtpChallenge.phone == phone).values(consumed=True, proof_hash=None)
        )
        challenge = OtpChallenge(
            id=challenge_id,
            phone=phone,
            purpose=purpose,
            code_hash=self.hash(f"{challenge_id}:{code}"),
            eligible=eligible,
            created_at=now,
            expires_at=now + timedelta(seconds=120),
        )
        self.db.add(challenge)
        if eligible and not self.settings.development_otp:
            enqueue_sms(self.db, kind="otp", reference_id=challenge_id, priority=0,
                        available_at=now, expires_at=challenge.expires_at,
                        secret_key=self.settings.secret_key, payload={"code": code})
        return {
            "challenge_id": str(challenge_id),
            "expires_in": 120,
            "retry_after": 30,
            "development": self.settings.development_otp,
        }

    @staticmethod
    def deliver_otp(db, settings, sender, challenge_id, payload, now):
        challenge = db.get(OtpChallenge, challenge_id)
        if challenge is None:
            return "skipped"
        lock(db, "phone:" + challenge.phone)
        db.refresh(challenge)
        # Recheck after locking: resend/verification can invalidate a queued code.
        if (challenge.consumed or not challenge.eligible or challenge.attempts >= 5
                or challenge.expires_at <= max(now, utcnow())):
            return "skipped"
        user = db.scalar(select(User).where(User.phone == challenge.phone))
        if (challenge.purpose == "signup" and user is not None) or (
            challenge.purpose != "signup" and (user is None or not user.active)
        ):
            return "skipped"
        sender.send_pattern(challenge.phone, settings.sms_template, {"code": payload["code"]})
        return "accepted"

    def verify_otp(self, challenge_id: UUID, code: str, ip: str):
        self.throttle("verify-ip:" + ip, 60)
        # Phone lock orders OTP issue, verify and registration transactions consistently.
        challenge = self.db.get(OtpChallenge, challenge_id)
        if not challenge:
            raise UserError("کد معتبر نیست یا منقضی شده؛ کد تازه بگیرین.")
        lock(self.db, "phone:" + challenge.phone)
        self.db.refresh(challenge)
        if challenge.consumed or challenge.expires_at <= utcnow() or challenge.attempts >= 5:
            raise UserError("کد معتبر نیست یا منقضی شده؛ کد تازه بگیرین.")
        challenge.attempts += 1
        if not hmac.compare_digest(challenge.code_hash, self.hash(f"{challenge.id}:{code}")):
            raise UserError("کد تأیید درست نیست؛ دوباره امتحان کنین.")
        user = self.by_phone(challenge.phone)
        if not challenge.eligible or (challenge.purpose != "signup" and (not user or not user.active)):
            challenge.consumed = True
            raise UserError(
                "ثبت‌نام با این شماره انجام نشد. اگه قبلاً حساب ساختین، از صفحهٔ ورود ادامه بدین."
                if challenge.purpose == "signup"
                else "برای این شماره حساب فعالی پیدا نشد. اگه هنوز ثبت‌نام نکردین، از صفحهٔ ثبت‌نام حساب بسازین."
            )
        challenge.consumed = True
        if challenge.purpose == "login":
            return user, None
        proof = secrets.token_urlsafe(32)
        challenge.proof_hash = self.hash(proof)
        challenge.proof_expires_at = utcnow() + timedelta(minutes=5)
        return None, proof

    def use_proof(self, proof: str, purpose: str):
        challenge = self.db.scalar(select(OtpChallenge).where(OtpChallenge.proof_hash == self.hash(proof)))
        if not challenge:
            raise UserError("تأیید شماره معتبر نیست؛ دوباره کد بگیرین.")
        lock(self.db, "phone:" + challenge.phone)
        self.db.refresh(challenge)
        if challenge.purpose != purpose or not challenge.proof_hash or challenge.proof_expires_at <= utcnow():
            raise UserError("تأیید شماره معتبر نیست؛ دوباره کد بگیرین.")
        challenge.proof_hash = None
        return challenge.phone

    def register(self, data):
        phone = self.use_proof(data.proof, "signup")
        if self.by_phone(phone):
            raise UserError("این شماره قبلاً ثبت‌نام کرده؛ وارد حسابتون بشین.", 409)
        user = User(
            phone=phone,
            first_name=data.first_name,
            last_name=data.last_name,
            password_hash=password_hasher.hash(data.password),
            created_at=utcnow(),
        )
        self.db.add(user)
        self.db.flush()
        if self.on_registered:
            self.on_registered(self.db, user.id)
        return user

    def password_login(self, phone: str, password: str, ip: str):
        self.throttle("password-ip:" + ip, 40)
        self.throttle("password-phone:" + phone, 10)
        lock(self.db, "phone:" + phone)
        user = self.by_phone(phone)
        if user:
            lock(self.db, "user:" + str(user.id))
            self.db.refresh(user)
        valid = password_matches(user.password_hash if user else dummy_hash, password)
        if not user or not valid or not user.active:
            raise UserError("شماره یا رمز عبور درست نیست یا حساب غیرفعاله.", 401)
        if password_hasher.check_needs_rehash(user.password_hash):
            user.password_hash = password_hasher.hash(password)
        return user

    def session(self, user: User, user_agent: str, previous_token: str | None):
        # Serialize session creation against suspension/password reset.
        lock(self.db, "user:" + str(user.id))
        self.db.refresh(user)
        if not user.active:
            raise UserError("این حساب غیرفعاله.", 403)
        if previous_token:
            self.db.execute(delete(LoginSession).where(LoginSession.token_hash == self.hash(previous_token)))
        token = secrets.token_urlsafe(32)
        now = utcnow()
        self.db.add(
            LoginSession(
                user_id=user.id,
                token_hash=self.hash(token),
                created_at=now,
                expires_at=now + timedelta(seconds=self.settings.session_seconds),
                user_agent=user_agent[:256],
            )
        )
        return token

    def authenticate(self, token: str | None):
        if not token or len(token) > 128:
            raise UserError("برای ادامه وارد حسابتون بشین.", 401)
        session = self.db.scalar(select(LoginSession).where(LoginSession.token_hash == self.hash(token)))
        if not session:
            raise UserError("نشست شما تمام شده؛ دوباره وارد بشین.", 401)
        lock(self.db, "user:" + str(session.user_id))
        session = self.db.scalar(
            select(LoginSession)
            .where(LoginSession.id == session.id)
            .execution_options(populate_existing=True)
        )
        if not session:
            raise UserError("نشست شما تمام شده؛ دوباره وارد بشین.", 401)
        user = self.db.get(User, session.user_id)
        if not user or not user.active or session.expires_at <= utcnow():
            raise UserError("نشست شما تمام شده؛ دوباره وارد بشین.", 401)
        return user, session

    def reset_password(self, proof: str, password: str):
        phone = self.use_proof(proof, "recovery")
        user = self.by_phone(phone)
        if not user:
            raise UserError("حساب قابل دسترسی نیست.", 400)
        lock(self.db, "user:" + str(user.id))
        self.db.refresh(user)
        if not user.active:
            raise UserError("حساب قابل دسترسی نیست.", 400)
        user.password_hash = password_hasher.hash(password)
        self.db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))

    def change_password(self, user: User, current: str, password: str):
        self.throttle("change-password:" + str(user.id), 10)
        if not password_matches(user.password_hash, current):
            raise UserError("رمز فعلی درست نیست.")
        user.password_hash = password_hasher.hash(password)
        self.db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))

    def admin_update(self, actor: User, target_id: UUID, active: bool, role: str):
        if actor.id == target_id:
            raise UserError("نقش و وضعیت حساب خودتون رو از این بخش نمی‌تونین تغییر بدین.")
        lock(self.db, "user:" + str(target_id))
        target = self.db.get(User, target_id)
        if not target:
            raise UserError("کاربر پیدا نشد.", 404)
        target.active, target.role = active, role
        self.db.execute(delete(LoginSession).where(LoginSession.user_id == target.id))
        return target

    def list_sessions(self, user, session):
        rows = self.db.scalars(
            select(LoginSession)
            .where(LoginSession.user_id == user.id, LoginSession.expires_at > utcnow())
            .order_by(LoginSession.created_at.desc())
        )
        return {
            "sessions": [
                {
                    "id": str(row.id),
                    "current": row.id == session.id,
                    "created_at": row.created_at.isoformat(),
                    "expires_at": row.expires_at.isoformat(),
                    "user_agent": row.user_agent,
                }
                for row in rows
            ]
        }

    def revoke_other_sessions(self, user, session):
        self.db.execute(
            delete(LoginSession).where(LoginSession.user_id == user.id, LoginSession.id != session.id)
        )

    def revoke_session(self, user, session_id):
        result = self.db.execute(
            delete(LoginSession).where(LoginSession.user_id == user.id, LoginSession.id == session_id)
        )
        if not result.rowcount:
            raise UserError("نشست پیدا نشد.", 404)

    def list_users(self, page, search):
        query = select(User)
        if search.strip():
            pattern = "%" + search.strip().replace("%", "\\%").replace("_", "\\_") + "%"
            query = query.where(
                User.phone.ilike(pattern) | User.first_name.ilike(pattern) | User.last_name.ilike(pattern)
            )
        total = self.db.scalar(select(func.count()).select_from(query.subquery()))
        rows = self.db.scalars(
            query.order_by(User.created_at.desc(), User.id).offset((page - 1) * 20).limit(20)
        )
        return {"users": [user_view(row) for row in rows], "total": total, "page": page, "page_size": 20}

    def logout(self, token: str):
        self.db.execute(delete(LoginSession).where(LoginSession.token_hash == self.hash(token)))

    def update_profile(self, user: User, first_name: str, last_name: str):
        user.first_name, user.last_name = first_name, last_name
        return user_view(user)

    def profile_summaries(self, ids):
        rows = self.db.execute(select(User.id, User.first_name, User.last_name).where(User.id.in_(ids)))
        return list(rows)
