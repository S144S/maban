"""Queue application API: enqueue in the caller's transaction, never send inline."""

import json
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.messaging.models import SmsJob
from app.messaging.processing import claim, dispatch, recover_interrupted
from app.messaging.security import payload_cipher

__all__ = ["claim", "dispatch", "enqueue_sms", "recover_interrupted"]


def enqueue_sms(db: Session, *, kind: str, reference_id: UUID, priority: int,
                available_at: datetime, expires_at: datetime, secret_key: str,
                payload: dict | None = None) -> None:
    """Reference IDs are unique per kind; rollback also rolls back the queued job."""
    encrypted = payload_cipher(secret_key).encrypt(json.dumps(payload or {}).encode()).decode()
    db.add(SmsJob(kind=kind, reference_id=reference_id, priority=priority,
                  available_at=available_at, expires_at=expires_at, created_at=available_at,
                  encrypted_payload=encrypted))
