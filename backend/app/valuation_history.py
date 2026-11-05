"""Exact valuation-history primitives; callers own their tables and holdings."""
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal, localcontext
from zoneinfo import ZoneInfo

from sqlalchemy import select, text

TEHRAN = ZoneInfo("Asia/Tehran")


def lock_history(db, namespace, user_id):
    # Serialize each owner's mutations, including their before/after snapshots.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
               {"key": f"{namespace}:{user_id}"})


def capture(db, model, user_id, holdings):
    previous = db.scalar(select(model).where(model.user_id == user_id)
                         .order_by(model.recorded_at.desc(), model.id.desc()).limit(1))
    if previous is None or previous.holdings != holdings:
        db.add(model(user_id=user_id, recorded_at=datetime.now(UTC), holdings=holdings))
        db.flush()


def valuation(holdings):
    if holdings is None:
        return None, 0
    missing = sum(row["price"] is None for row in holdings)
    total = sum((Decimal(row["quantity"]) * Decimal(row["price"])
                 for row in holdings if row["price"] is not None), Decimal(0))
    return total, missing


def effects(before, after):
    """Separate price effects on existing units from additions/removals.

    Missing prices invalidate the attribution, never masquerade as a loss.
    """
    old, new = ({r["id"]: r for r in rows} for rows in (before, after))
    price, flow = Decimal(0), Decimal(0)
    for key in old.keys() | new.keys():
        a, b = old.get(key), new.get(key)
        if (a and a["price"] is None) or (b and b["price"] is None):
            return None, None
        if a and b:
            price += Decimal(a["quantity"]) * (Decimal(b["price"]) - Decimal(a["price"]))
            flow += (Decimal(b["quantity"]) - Decimal(a["quantity"])) * Decimal(b["price"])
        elif b:
            flow += Decimal(b["quantity"]) * Decimal(b["price"])
        else:
            flow -= Decimal(a["quantity"]) * Decimal(a["price"])
    return price, flow


def report_history(db, model, user_id, start, end):
    with localcontext() as context:
        context.prec = 80
        return _report(db, model, user_id, start, end)


def _report(db, model, user_id, start, end):
    lower = datetime.combine(start, time.min, TEHRAN)
    upper = datetime.combine(end + timedelta(days=1), time.min, TEHRAN)
    owned = select(model).where(model.user_id == user_id)
    opening = db.scalar(owned.where(model.recorded_at < lower)
                        .order_by(model.recorded_at.desc(), model.id.desc()).limit(1))
    events = db.scalars(owned.where(model.recorded_at >= lower, model.recorded_at < upper)
                        .order_by(model.recorded_at, model.id)).all()
    first = db.scalar(owned.order_by(model.recorded_at, model.id).limit(1))
    previous_end = start - timedelta(days=1)
    previous_start = start - timedelta(days=(end - start).days + 1)
    state = opening.holdings if opening else None
    opening_total, opening_missing = valuation(state)
    gain = flow = Decimal(0)
    comparable = state is not None and not opening_missing
    daily, index = [], 0
    today = datetime.now(TEHRAN).date()
    day = start
    while day <= end:
        while index < len(events) and events[index].recorded_at.astimezone(TEHRAN).date() <= day:
            event = events[index]
            if state is not None:
                price_effect, holding_effect = effects(state, event.holdings)
                if price_effect is None:
                    comparable = False
                else:
                    gain += price_effect
                    flow += holding_effect
            state = event.holdings
            index += 1
        total, missing = valuation(state)
        daily.append({"date": day.isoformat(),
                      "total_toman": format(total, "f") if total is not None and day <= today else None,
                      "unpriced_count": missing})
        day += timedelta(days=1)
    total, missing = valuation(state)
    comparable = comparable and end <= today
    groups = {}
    for row in state or []:
        group = groups.setdefault(row["kind"], {"kind": row["kind"], "total": Decimal(0), "unpriced_count": 0})
        if row["price"] is None:
            group["unpriced_count"] += 1
        else:
            group["total"] += Decimal(row["quantity"]) * Decimal(row["price"])
    percentage = gain * 100 / opening_total if comparable and opening_total else None
    return {"start": start.isoformat(), "end": end.isoformat(),
            "history_start": first.recorded_at.astimezone(TEHRAN).date().isoformat() if first else None,
            "total_toman": format(total, "f") if total is not None and end <= today else None,
            "unpriced_count": missing, "count": len(state or []),
            "previous_start": previous_start.isoformat(), "previous_end": previous_end.isoformat(),
            "previous_total_toman": format(opening_total, "f") if opening_total is not None and not opening_missing else None,
            "price_change_toman": format(gain, "f") if comparable else None,
            "holdings_change_toman": format(flow, "f") if comparable else None,
            "price_change_percent": format(percentage, ".2f") if percentage is not None else None,
            "daily": daily,
            "groups": [{"kind": g["kind"], "total_toman": format(g["total"], "f"),
                        "unpriced_count": g["unpriced_count"]} for g in groups.values()]}
