"""Migration-only registration, not a business-module interface."""

from app.users.models import LoginSession, OtpChallenge, RateBucket, User

SCHEMA = "users"
TABLES = tuple(model.__table__ for model in (User, LoginSession, OtpChallenge, RateBucket))
