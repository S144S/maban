"""Local operator commands; never expose role bootstrapping through public HTTP."""

import argparse

from sqlalchemy import delete, select

from app.config import Settings
from app.database import database
from app.users.models import LoginSession, OtpChallenge, RateBucket, User
from app.users.schemas import PasswordLogin
from app.users.service import lock, utcnow


def run():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    admin = sub.add_parser("make-admin")
    admin.add_argument("phone")
    sub.add_parser("cleanup")
    args = parser.parse_args()
    engine, factory = database(Settings().database_url)
    with factory.begin() as db:
        if args.command == "make-admin":
            phone = PasswordLogin(phone=args.phone, password="unused").phone
            lock(db, "admin-management")
            user = db.scalar(select(User).where(User.phone == phone))
            if not user or not user.active:
                parser.error("Register and verify an active account first")
            lock(db, "user:" + str(user.id))
            user.role = "admin"
            db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
            print("Administrator role granted. Sign in again.")
        else:
            db.execute(delete(LoginSession).where(LoginSession.expires_at < utcnow()))
            db.execute(delete(RateBucket).where(RateBucket.expires_at < utcnow()))
            db.execute(
                delete(OtpChallenge).where(
                    OtpChallenge.expires_at < utcnow(),
                    (OtpChallenge.proof_expires_at.is_(None)) | (OtpChallenge.proof_expires_at < utcnow()),
                )
            )
            print("Expired authentication records removed.")
    engine.dispose()
