"""At-most-once dispatch: interrupted claims become unknown, never pending again."""

import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import UUID

from cryptography.fernet import InvalidToken
from sqlalchemy import select

from app.messaging.models import SmsJob
from app.messaging.security import payload_cipher
from app.sms import SmsDeliveryError, SmsRejected

CLAIM_TIMEOUT = timedelta(minutes=2)


def claim(sessions, kinds: list[str], now: datetime) -> UUID | None:
    with sessions.begin() as db:
        job = db.scalar(select(SmsJob).where(
            SmsJob.status == "pending", SmsJob.kind.in_(kinds), SmsJob.available_at <= now,
        ).order_by(SmsJob.priority, SmsJob.available_at, SmsJob.id).limit(1).with_for_update(skip_locked=True))
        if job is None:
            return None
        job.status, job.claimed_at = "processing", now
        return job.id


def _finish(db, job, status, now, completed):
    completed(db, job.kind, job.reference_id, status)
    job.status, job.finished_at, job.encrypted_payload = status, now, None


def dispatch(sessions, job_id: UUID, secret_key: str, handlers: dict[str, Callable],
             completed: Callable, *, now: datetime | None = None) -> None:
    with sessions.begin() as db:
        job = db.scalar(select(SmsJob).where(SmsJob.id == job_id).with_for_update())
        if job is None or job.status != "processing":
            return
        current = now or datetime.now(UTC)
        if job.claimed_at + CLAIM_TIMEOUT <= current:
            status = "unknown"
        elif job.expires_at <= current:
            status = "skipped"
        else:
            try:
                payload = json.loads(payload_cipher(secret_key).decrypt(job.encrypted_payload.encode()))
                status = handlers[job.kind](db, job.reference_id, payload, current)
            except SmsRejected:
                status = "failed"
            except SmsDeliveryError:
                status = "unknown"
            except (InvalidToken, ValueError):
                status = "failed"
        _finish(db, job, status, current, completed)


def recover_interrupted(sessions, kinds: list[str], completed: Callable, now: datetime,
                        limit: int = 100) -> int:
    with sessions.begin() as db:
        jobs = db.scalars(select(SmsJob).where(
            SmsJob.status == "processing", SmsJob.kind.in_(kinds),
            SmsJob.claimed_at <= now - CLAIM_TIMEOUT,
        ).order_by(SmsJob.claimed_at).limit(limit).with_for_update(skip_locked=True)).all()
        for job in jobs:
            _finish(db, job, "unknown", now, completed)
        return len(jobs)
