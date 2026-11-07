from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from conftest import HEADERS
from fastapi.testclient import TestClient
from test_families import accept, account, create, invite
from test_users import register

from app.plants.service import next_due


def payload(**changes):
    return {"name": "پتوس خونه", "location": "کنار پنجره", "soil_interval": 3,
            "soil_due": "2026-01-01", "fertilizer_interval": 20, "fertilizer_due": "2030-01-01",
            "request_id": str(uuid4()), **changes}


def test_next_due_uses_local_day_not_utc_or_previous_due():
    assert next_due(datetime(2026, 12, 31, 21, tzinfo=UTC), 3) == date(2027, 1, 4)
    assert next_due(datetime(2028, 2, 28, 21, tzinfo=UTC), 1) == date(2028, 3, 1)
    assert next_due(datetime(2026, 3, 7, 23, tzinfo=UTC), 1, "America/New_York") == date(2026, 3, 8)
    with pytest.raises(ValueError):
        next_due(datetime(2026, 1, 1), 1)


def test_full_flow_and_durable_retries(client, monkeypatch):
    monkeypatch.setattr("app.plants.service.now", lambda: datetime(2026, 1, 2, tzinfo=UTC))
    assert client.get(f"/api/families/{uuid4()}/plants").status_code == 401
    user = register(client)
    family = create(client)
    base = f"/api/families/{family}/plants"
    data = payload(assignee_id=user["id"])
    response = client.post(base, json=data)
    assert response.status_code == 201, response.text
    plant = response.json()["plant"]
    assert plant["soil"]["status"] == "overdue"
    assert client.post(base, json=data).json() == response.json()
    assert client.post(base, json={**data, "name": "دیگه"}).status_code == 409
    url = f"{base}/{plant['id']}"
    assert len(client.get(base).json()["plants"]) == 1
    care = {"request_id": str(uuid4()), "action": "not_needed", "note": "خاک هنوز مرطوبه"}
    monkeypatch.setattr("app.plants.service.now", lambda: datetime(2026, 12, 31, 21, tzinfo=UTC))
    result = client.post(url + "/care", json=care)
    assert result.status_code == 201, result.text
    event = result.json()["event"]
    assert event["next_due"] == "2027-01-04" and event["actor_id"] == user["id"]
    fields = {k: v for k, v in data.items() if k != "request_id"}
    fields.update(name="پتوس بزرگ", soil_interval=5, soil_due="2027-02-01")
    assert client.put(url, json=fields).status_code == 200
    # A late retry returns its original receipt without overwriting a newer schedule.
    assert client.post(url + "/care", json=care).json() == result.json()
    detail = client.get(url).json()["plant"]
    assert detail["soil"]["next_due"] == "2027-02-01"
    assert detail["fertilizer"]["next_due"] == "2030-01-01"
    assert client.post(url + "/care", json={**care, "action": "watered"}).status_code == 409
    watered = client.post(url + "/care", json={"request_id": str(uuid4()), "action": "watered"})
    assert watered.json()["event"]["next_due"] == "2027-01-06"
    fertilized = client.post(url + "/care", json={"request_id": str(uuid4()), "action": "fertilized"})
    assert fertilized.json()["event"]["next_due"] == "2027-01-21"
    events = client.get(url + "/history").json()["events"]
    assert len(events) == 3
    assert all(e["actor_name"] == "سعید آزمایشی" and e["performed_at"].endswith("+00:00") for e in events)
    assert client.post(base, json=data).json()["plant"]["name"] == "پتوس بزرگ"
    assert client.delete(url).status_code == 204
    assert client.delete(url).status_code == 204
    assert client.get(base).json()["plants"] == []
    for suffix in ("", "/history"):
        assert client.get(url + suffix).status_code == 404
    assert client.post(url + "/care", json=care).status_code == 404
    assert client.post(base, json=data).status_code == 409


def test_statuses_follow_tehran_midnight_without_schedule_writes(client, monkeypatch):
    monkeypatch.setattr("app.plants.service.now", lambda: datetime(2026, 1, 1, 20, tzinfo=UTC))
    register(client)
    base = f"/api/families/{create(client)}/plants"
    plant = client.post(base, json=payload(soil_due="2026-01-02")).json()["plant"]
    url = f"{base}/{plant['id']}"
    assert plant["soil"]["status"] == "upcoming"
    # Tehran has crossed midnight while the UTC date is still January 1.
    monkeypatch.setattr("app.plants.service.now", lambda: datetime(2026, 1, 1, 21, tzinfo=UTC))
    assert client.get(url).json()["plant"]["soil"]["status"] == "today"
    monkeypatch.setattr("app.plants.service.now", lambda: datetime(2026, 1, 2, 21, tzinfo=UTC))
    listed = client.get(base).json()
    assert listed["timezone"] == "Asia/Tehran"
    assert listed["plants"][0]["soil"] == {
        "interval_days": 3, "next_due": "2026-01-02", "status": "overdue"
    }
    assert client.get(url + "/history").json()["events"] == []


def test_family_isolation_assignment_and_member_actor(client, app):
    register(client)
    family = create(client)
    base = f"/api/families/{family}/plants"
    row = client.post(base, json=payload()).json()["plant"]
    url = f"{base}/{row['id']}"
    other_client, other_user = account(app, "09123456780")
    with other_client as other:
        own_family = create(other)
        care = {"request_id": str(uuid4()), "action": "watered"}
        for path in (base, url, url + "/history"):
            assert other.get(path).status_code == 404
        assert other.post(base, json=payload()).status_code == 404
        assert other.put(url, json={k: v for k, v in payload().items() if k != "request_id"}).status_code == 404
        assert other.delete(url).status_code == 404
        assert other.post(url + "/care", json=care).status_code == 404
        assert other.get(f"/api/families/{own_family}/plants/{row['id']}").status_code == 404
        assert client.post(base, json=payload(assignee_id=str(uuid4()))).status_code == 404
        assert accept(other, invite(client, family)["token"]).status_code == 200
        result = other.post(url + "/care", json=care)
        assert result.status_code == 201
        assert result.json()["event"]["actor_id"] == other_user["id"]
        member_id = result.json()["event"]["actor_id"]
        assert client.post(base, json=payload(assignee_id=member_id)).status_code == 201
        assert other.post(url + "/care", json={**care, "actor_id": str(uuid4())}).status_code == 422
        assert client.post(url + "/care", json=care).status_code == 409


def test_concurrent_care_retries_are_atomic(client, app):
    register(client)
    family = create(client)
    base = f"/api/families/{family}/plants"
    row = client.post(base, json=payload()).json()["plant"]
    url = f"{base}/{row['id']}"
    data = {"request_id": str(uuid4()), "action": "watered"}
    cookies = dict(client.cookies)

    def send(_):
        with TestClient(app, headers=HEADERS, cookies=cookies) as concurrent:
            response = concurrent.post(url + "/care", json=data)
            assert response.status_code == 201, response.text
            return response.json()

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(send, range(4)))
    assert all(result == results[0] for result in results)
    assert len(client.get(url + "/history").json()["events"]) == 1


def test_validation_optional_fertilizer_and_migration(client):
    register(client)
    base = f"/api/families/{create(client)}/plants"
    for changes in ({"name": " "}, {"location": ""}, {"soil_interval": 0}, {"soil_interval": 366},
                    {"soil_interval": True}, {"soil_interval": 1.5}, {"soil_due": "2026-02-30"},
                    {"soil_due": 123}, {"soil_due": "2200-01-01"}, {"note": "x" * 2001},
                    {"fertilizer_interval": None}, {"fertilizer_due": None}, {"user_id": str(uuid4())}):
        response = client.post(base, json=payload(**changes))
        assert response.status_code == 422, response.text
    row = client.post(base, json=payload(fertilizer_interval=None, fertilizer_due=None)).json()["plant"]
    url = f"{base}/{row['id']}"
    assert row["fertilizer"] is None
    assert client.post(url + "/care", json={"request_id": str(uuid4()), "action": "fertilized"}).status_code == 409
    assert client.get(base + "?offset=-1").status_code == 422
    command.check(Config("alembic.ini"))
    with pytest.raises(RuntimeError, match="Refusing"):
        command.downgrade(Config("alembic.ini"), "a25431a9e6f7")
