from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.wallets.errors import WalletError
from app.wallets.models import Entry, SignupGift, Topup, Wallet
from app.wallets.pricing import ENGLISH_PART_TOMAN, PERSIAN_PART_TOMAN


def locked_wallet(db, family_id):
    db.execute(insert(Wallet).values(family_id=family_id, balance_toman=0).on_conflict_do_nothing())
    return db.scalar(select(Wallet).where(Wallet.family_id == family_id).with_for_update())


def record(db, wallet, kind, reference_id, amount):
    wallet.balance_toman += amount
    db.add(Entry(family_id=wallet.family_id, kind=kind, reference_id=reference_id, amount_toman=amount,
                 balance_after=wallet.balance_toman, created_at=datetime.now(UTC)))
    db.flush()


def register_signup_gift(db, user_id):
    """Create eligibility only for a successful new registration, in its transaction."""
    db.execute(insert(SignupGift).values(user_id=user_id).on_conflict_do_nothing())


def claim_signup_gift(db, user_id, family_id):
    """Credit the first joined family exactly once, atomically with membership."""
    gift = db.scalar(select(SignupGift).where(SignupGift.user_id == user_id).with_for_update())
    if gift is None or gift.family_id is not None:
        return
    wallet = locked_wallet(db, family_id)
    record(db, wallet, "signup_gift", user_id, 5000)
    gift.family_id = family_id
    db.flush()


def reserve_sms(db, family_id, reference_id, price):
    """Commit with the queue insertion BEFORE any external send. Replays cannot debit twice."""
    if price <= 0:
        raise ValueError("SMS price must be positive")
    wallet = locked_wallet(db, family_id)
    existing = db.scalar(select(Entry).where(Entry.kind == "sms", Entry.reference_id == reference_id))
    if existing:
        return existing.family_id == family_id and not db.scalar(select(Entry.id).where(
            Entry.kind == "sms_refund", Entry.reference_id == reference_id))
    if wallet.balance_toman < price:
        return False
    record(db, wallet, "sms", reference_id, -price)
    return True


def sms_reserved(db, reference_id):
    return db.scalar(select(Entry.id).where(Entry.kind == "sms", Entry.reference_id == reference_id)) is not None


def settle_sms(db, reference_id, status):
    # Uncertain sends retain their reservation; never refund and retry an uncertain send.
    if status not in {"failed", "skipped"}:
        return
    debit = db.scalar(select(Entry).where(Entry.kind == "sms", Entry.reference_id == reference_id))
    if debit is None:
        return
    wallet = locked_wallet(db, debit.family_id)
    if db.scalar(select(Entry.id).where(Entry.kind == "sms_refund", Entry.reference_id == reference_id)) is None:
        record(db, wallet, "sms_refund", reference_id, -debit.amount_toman)


class Wallets:
    def __init__(self, db, settings, gateway):
        self.db, self.settings, self.gateway = db, settings, gateway

    def summary(self, family_id):
        balance = self.db.scalar(select(Wallet.balance_toman).where(Wallet.family_id == family_id)) or 0
        return {"balance_toman": balance, "sms_persian_part_toman": PERSIAN_PART_TOMAN,
                "sms_english_part_toman": ENGLISH_PART_TOMAN,
                "topup_enabled": bool(self.settings.payment_merchant_id and self.settings.payment_callback_url)}

    def entries(self, family_id, offset):
        rows = self.db.scalars(select(Entry).where(Entry.family_id == family_id)
                               .order_by(Entry.created_at.desc(), Entry.id.desc()).offset(offset).limit(51)).all()
        return {"entries": [{"id": r.id, "kind": r.kind, "amount_toman": r.amount_toman,
                             "balance_after": r.balance_after, "created_at": r.created_at} for r in rows[:50]],
                "has_more": len(rows) > 50}

    def topups(self, family_id, offset):
        rows = self.db.scalars(select(Topup).where(Topup.family_id == family_id)
                               .order_by(Topup.created_at.desc(), Topup.id.desc()).offset(offset).limit(51)).all()
        return {"topups": [self.topup_view(r) for r in rows[:50]], "has_more": len(rows) > 50}

    def topup_view(self, row):
        return {"id": row.id, "family_id": row.family_id, "amount_toman": row.amount_toman, "status": row.status,
                "reference": row.reference, "created_at": row.created_at,
                "checkout_url": self.gateway.checkout_url(row.authority) if row.status == "pending" else None}

    def create_topup(self, family_id, data, actor_user_id=None):
        locked_wallet(self.db, family_id)
        row = self.db.scalar(select(Topup).where(Topup.family_id == family_id, Topup.request_id == data.request_id))
        if row:
            if row.amount_toman != data.amount_toman:
                raise WalletError("مبلغ این درخواست تغییر کرده؛ درخواست تازه‌ای ثبت کنین.", 409)
            return self.topup_view(row)
        pending = self.db.scalar(select(func.count()).select_from(Topup).where(
            Topup.family_id == family_id, Topup.status == "pending",
            Topup.created_at > datetime.now(UTC) - timedelta(days=1)))
        if pending >= 5:
            raise WalletError("اول وضعیت پرداخت‌های قبلی رو بررسی کنین؛ امروز درخواست‌های زیادی ثبت شده.", 429)
        authority = self.gateway.request(data.amount_toman)
        row = Topup(id=uuid4(), family_id=family_id, actor_user_id=actor_user_id, request_id=data.request_id, amount_toman=data.amount_toman,
                    authority=authority, status="pending", created_at=datetime.now(UTC))
        self.db.add(row)
        self.db.flush()
        return self.topup_view(row)

    def callback_family(self, authority):
        return self.db.scalar(select(Topup.family_id).where(Topup.authority == authority))

    def verify(self, *, family_id=None, topup_id=None, authority=None):
        query = select(Topup)
        if family_id is not None:
            query = query.where(Topup.family_id == family_id, Topup.id == topup_id)
        else:
            query = query.where(Topup.authority == authority)
        row = self.db.scalar(query.with_for_update())
        if row is None:
            raise WalletError("پرداخت پیدا نشد.", 404)
        if row.status == "paid":
            return self.topup_view(row)
        reference = self.gateway.verify(row.authority, row.amount_toman)
        wallet = locked_wallet(self.db, row.family_id)
        record(self.db, wallet, "topup", row.id, row.amount_toman)
        row.status, row.reference, row.paid_at = "paid", reference, datetime.now(UTC)
        self.db.flush()
        return self.topup_view(row)
