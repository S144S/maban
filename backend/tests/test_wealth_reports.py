from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import func, select
from test_families import account
from test_users import register

from app.assets.models import AssetSnapshot
from app.investments.models import InvestmentSnapshot
from app.valuation_history import effects


def holding(key="gold", quantity="2.125", price="100", kind="gold"):
    return {"id": key, "kind": kind, "label": kind, "quantity": quantity, "price": price}


@pytest.mark.parametrize("module,model", [("investments", InvestmentSnapshot), ("assets", AssetSnapshot)])
def test_exact_private_history_price_flow_and_tehran_boundaries(client, app, module, model):
    url = f"/api/{module}/report?start=2026-01-02&end=2026-01-03"
    assert client.get(url).status_code == 401
    user = register(client)
    tz = ZoneInfo("Asia/Tehran")
    snapshots = [
        (datetime(2026, 1, 1, 23, 59, tzinfo=tz), [holding()]),
        (datetime(2026, 1, 2, 0, 0, tzinfo=tz), [holding(price="200")]),
        (datetime(2026, 1, 2, 10, tzinfo=tz), [holding(price="200"), holding("new", "1", "200")]),
        (datetime(2026, 1, 3, 12, tzinfo=tz), [holding(price="150"), holding("new", "1", "150")]),
        # Exactly the next day's boundary must not leak into the selected range.
        (datetime(2026, 1, 4, 0, 0, tzinfo=tz), [holding(price="999")]),
    ]
    with app.state.sessions.begin() as db:
        for when, holdings in snapshots:
            db.add(model(user_id=UUID(user["id"]), recorded_at=when, holdings=holdings))
    result = client.get(url)
    assert result.status_code == 200, result.text
    data = result.json()
    assert Decimal(data["total_toman"]) == Decimal("468.75")
    assert Decimal(data["price_change_toman"]) == Decimal("56.25")
    assert Decimal(data["holdings_change_toman"]) == 200
    assert Decimal(data["previous_total_toman"]) == Decimal("212.5")
    assert data["price_change_percent"] == "26.47"
    assert [Decimal(d["total_toman"]) for d in data["daily"]] == [Decimal(625), Decimal("468.75")]
    other, _ = account(app, "09123456780")
    with other:
        assert other.get(url).json()["total_toman"] is None
    for query in ("start=2026-01-03&end=2026-01-02", "start=2020-01-01&end=2026-01-01", "start=bad&end=2026-01-01"):
        assert client.get(f"/api/{module}/report?{query}").status_code == 422
    before = client.get(f"/api/{module}/report?start=2025-12-29&end=2025-12-30").json()
    assert before["total_toman"] is None and before["price_change_toman"] is None


def test_mutations_capture_history_atomically_without_duplicate_retries(client, app):
    user = register(client)
    payload = {"request_id": str(uuid4()), "kind": "gold", "grams": "2.125"}
    assert client.post("/api/investments", json=payload).status_code == 201
    def snapshots():
        with app.state.sessions() as db:
            return db.scalar(select(func.count()).select_from(InvestmentSnapshot).where(InvestmentSnapshot.user_id == UUID(user["id"])))
    count = snapshots()
    assert count == 2  # Empty baseline, then the new holding.
    assert client.post("/api/investments", json=payload).status_code == 201
    assert snapshots() == count
    for price in (100, 100, 200, None):
        assert client.put("/api/investments/rates", json={"kind": "gold", "unit_price_toman": price}).status_code == 200
    assert snapshots() == count + 3
    today = datetime.now(ZoneInfo("Asia/Tehran")).date()
    data = client.get(f"/api/investments/report?start={today - timedelta(days=1)}&end={today}").json()
    assert data["daily"][0]["total_toman"] is None
    assert data["unpriced_count"] == 1
    assert data["price_change_toman"] is None
    # A missing quote must never become a fictitious loss or profit.
    assert effects([holding()], [holding(price=None)]) == (None, None)


def test_asset_rate_changes_keep_purchase_and_history(client, app):
    user = register(client)
    result = client.post("/api/assets", json={"request_id": str(uuid4()), "kind": "land",
        "title": "زمین", "location": "تهران", "area_sqm": "100.25", "purchase_price_toman": 500})
    assert result.status_code == 201, result.text
    asset = result.json()["entry"]["id"]
    for price in (100, 200, None):
        assert client.put(f"/api/assets/rates/{asset}", json={"unit_price_toman": price}).status_code == 200
    with app.state.sessions() as db:
        rows = db.scalars(select(AssetSnapshot).where(AssetSnapshot.user_id == UUID(user["id"])).order_by(AssetSnapshot.id)).all()
        assert len(rows) == 5
        assert rows[2].holdings[0]["price"] == "100"
        assert rows[3].holdings[0]["quantity"] == "100.25"
        assert rows[4].holdings[0]["price"] is None
    assert client.get("/api/assets").json()["entries"][0]["purchase_price_toman"] == 500


@pytest.mark.usefixtures("before_signup_gifts")
def test_migration_seeds_existing_rates_without_inventing_past(client, app):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import delete

    register(client)
    assert client.post("/api/investments", json={"request_id": str(uuid4()), "kind": "gold", "grams": "2.125"}).status_code == 201
    client.put("/api/investments/rates", json={"kind": "gold", "unit_price_toman": 100})
    result = client.post("/api/assets", json={"request_id": str(uuid4()), "kind": "land",
        "title": "زمین", "location": "تهران", "area_sqm": "100.25"})
    asset = result.json()["entry"]["id"]
    client.put(f"/api/assets/rates/{asset}", json={"unit_price_toman": 200})
    # Reproduce a pre-history database only inside this fixture's isolated database.
    with app.state.sessions.begin() as db:
        db.execute(delete(InvestmentSnapshot))
        db.execute(delete(AssetSnapshot))
    command.downgrade(Config("alembic.ini"), "def21097b3c4")
    command.upgrade(Config("alembic.ini"), "head")
    today = datetime.now(ZoneInfo("Asia/Tehran")).date()
    for module, expected in (("investments", "212.5"), ("assets", "20050")):
        report = client.get(f"/api/{module}/report?start={today-timedelta(days=2)}&end={today}").json()
        assert Decimal(report["total_toman"]) == Decimal(expected)
        assert report["history_start"] == today.isoformat()
        assert report["daily"][0]["total_toman"] is None
        assert report["price_change_toman"] is None
