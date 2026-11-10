"""Tehran wall-clock recurrence; monthly schedules follow the Persian calendar."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import jdatetime

TEHRAN = ZoneInfo("Asia/Tehran")


def _month(anchor: datetime, offset: int) -> datetime:
    date = jdatetime.date.fromgregorian(date=anchor.date())
    year, month = divmod(date.year * 12 + date.month - 1 + offset, 12)
    month += 1
    last = 31 if month <= 6 else 30 if month < 12 or jdatetime.date(year, 1, 1).isleap() else 29
    day = jdatetime.date(year, month, min(date.day, last)).togregorian()
    return anchor.replace(year=day.year, month=day.month, day=day.day)


def occurrence_window(anchor: datetime, recurrence: str, now: datetime) -> tuple[datetime, datetime | None]:
    """Latest due occurrence and first future occurrence; never replay a backlog."""
    anchor, now = anchor.astimezone(TEHRAN), now.astimezone(TEHRAN)
    if recurrence == "none":
        return anchor.astimezone(UTC), None
    if recurrence in {"daily", "weekly", "fortnightly"}:
        days = {"daily": 1, "weekly": 7, "fortnightly": 14}[recurrence]
        index = max(0, (now.date() - anchor.date()).days // days)
        due = anchor + timedelta(days=index * days)
        if due > now and index:
            due -= timedelta(days=days)
        following = due + timedelta(days=days)
    elif recurrence == "monthly":
        start = jdatetime.date.fromgregorian(date=anchor.date())
        end = jdatetime.date.fromgregorian(date=now.date())
        index = max(0, (end.year - start.year) * 12 + end.month - start.month)
        due = _month(anchor, index)
        if due > now and index:
            index -= 1
            due = _month(anchor, index)
        following = _month(anchor, index + 1)
    else:
        raise ValueError("Unsupported reminder recurrence")
    return due.astimezone(UTC), following.astimezone(UTC)


def pattern_attributes(title: str, due_at: datetime, amount_toman: int | None) -> dict[str, str]:
    local = due_at.astimezone(TEHRAN)
    date = jdatetime.date.fromgregorian(date=local.date())
    return {
        "title": title,
        "date": f"{date.year:04d}/{date.month:02d}/{date.day:02d}",
        "time": local.strftime("%H:%M"),
        "amount": str(amount_toman) if amount_toman is not None else "بدون مبلغ",
    }
