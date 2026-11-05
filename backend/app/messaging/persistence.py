"""Migration-only registration."""

from app.messaging.models import SmsJob

SCHEMA = "messaging"
TABLES = (SmsJob.__table__,)
