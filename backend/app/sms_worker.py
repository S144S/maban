"""Composition root for all queued SMS: python -m app.sms_worker [--once]."""

import argparse
import logging
import signal
from datetime import UTC, datetime
from functools import partial
from threading import Event

from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings
from app.database import database
from app.messaging.public import claim, dispatch, recover_interrupted
from app.reminders.public import deliver_reminder, record_sms_result, schedule_sms
from app.sms import IranPayamakSms
from app.users.public import deliver_otp

logger = logging.getLogger(__name__)


def completed(db, kind, reference_id, status):
    if kind == "reminder":
        record_sms_result(db, reference_id, status)


def handlers(settings, sender):
    result = {"otp": lambda db, ref, payload, now: deliver_otp(db, settings, sender, ref, payload, now)}
    if settings.reminder_sms_enabled:
        result["reminder"] = lambda db, ref, payload, now: deliver_reminder(
            db, settings, sender, ref, payload, now)
    return result


def run_batch(sessions, settings, sender=None, *, now=None, limit=100):
    if settings.development_otp:
        return 0
    sender = sender if sender is not None else IranPayamakSms(settings)
    routes = handlers(settings, sender)
    clock = (lambda: now) if now is not None else partial(datetime.now, UTC)
    # Recover both kinds even if reminders were disabled after a process crash.
    recover_interrupted(sessions, ["otp", "reminder"], completed, clock(), limit)
    processed = 0
    for _ in range(limit):
        # Produce at most one reminder per iteration, then always select OTP first.
        schedule_sms(sessions, settings, clock())
        job_id = claim(sessions, list(routes), clock())
        if job_id is None:
            break
        dispatch(sessions, job_id, settings.secret_key, routes, completed, now=now)
        processed += 1
    return processed


def main():
    parser = argparse.ArgumentParser(description="Dispatch queued MaBan OTP and reminder SMS")
    parser.add_argument("--once", action="store_true", help="Process up to 100 jobs and exit")
    args = parser.parse_args()
    settings = Settings()
    if settings.development_otp:
        print("Development SMS is disabled; no jobs consumed or messages sent.")
        return
    engine, sessions = database(settings.database_url)
    stopped = Event()
    for name in (signal.SIGINT, signal.SIGTERM):
        signal.signal(name, lambda *_: stopped.set())
    try:
        while not stopped.is_set():
            try:
                count = run_batch(sessions, settings)
            except SQLAlchemyError:
                logger.error("SMS worker database operation failed")
                if args.once:
                    raise SystemExit(1) from None
                count = 0
            if args.once:
                break
            if count < 100:
                stopped.wait(1)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
