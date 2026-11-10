"""Reconcile abandoned/replaced photo objects after outages or interrupted writes."""

import argparse
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select

from app.plants.models import Plant
from app.plants.service import lock_family


def cleanup(sessions, photos, *, apply=False, at=None):
    cutoff = (at or datetime.now(UTC)) - timedelta(hours=24)
    candidates = removed = 0
    for obj in photos.objects():
        parts = obj.key.split("/")
        if (len(parts) != 4 or parts[0] != "plants" or not parts[3].endswith(".jpg")
                or obj.modified_at >= cutoff):
            continue
        try:
            family_id = UUID(parts[1])
            UUID(parts[2])
            UUID(parts[3].removesuffix(".jpg"))
        except ValueError:
            continue
        with sessions.begin() as db:
            # Same lock as upload/read: an in-flight write cannot race this check.
            lock_family(db, family_id)
            if db.scalar(select(Plant.id).where(Plant.photo_key == obj.key)) is not None:
                continue
            candidates += 1
            if apply:
                photos.remove(obj.key)
                removed += 1
    return {"candidates": candidates, "removed": removed}


if __name__ == "__main__":
    from app.config import Settings
    from app.database import database
    from app.plants.storage import MinioPhotos

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Delete unreferenced objects older than 24 hours")
    args = parser.parse_args()
    settings = Settings()
    engine, sessions = database(settings.database_url)
    try:
        print(cleanup(sessions, MinioPhotos(settings), apply=args.apply))
    finally:
        engine.dispose()
