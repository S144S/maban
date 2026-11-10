from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from conftest import HEADERS
from fastapi.testclient import TestClient
from sqlalchemy import text
from test_families import accept, account, create, invite
from test_users import register

from app.plants.service import fingerprint


def payload(**changes):
    return {"name": "پتوس خونه", "location": "کنار پنجره",
            "request_id": str(uuid4()), **changes}


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
    assert "soil" not in plant and "fertilizer" not in plant
    assert client.post(base, json=data).json() == response.json()
    assert client.post(base, json={**data, "name": "دیگه"}).status_code == 409
    url = f"{base}/{plant['id']}"
    assert len(client.get(base).json()["plants"]) == 1
    care = {"request_id": str(uuid4()), "action": "not_needed", "note": "خاک هنوز مرطوبه"}
    monkeypatch.setattr("app.plants.service.now", lambda: datetime(2026, 12, 31, 21, tzinfo=UTC))
    result = client.post(url + "/care", json=care)
    assert result.status_code == 201, result.text
    event = result.json()["event"]
    assert "next_due" not in event and event["actor_id"] == user["id"]
    assert event["performed_at"] == "2026-12-31T21:00:00+00:00"
    fields = {k: v for k, v in data.items() if k != "request_id"}
    fields.update(name="پتوس بزرگ")
    assert client.put(url, json=fields).status_code == 200
    # A late retry returns its original receipt without changing plant metadata.
    assert client.post(url + "/care", json=care).json() == result.json()
    detail = client.get(url).json()["plant"]
    assert detail["name"] == "پتوس بزرگ"
    assert "soil" not in detail and "fertilizer" not in detail
    assert client.post(url + "/care", json={**care, "action": "watered"}).status_code == 409
    watered = client.post(url + "/care", json={"request_id": str(uuid4()), "action": "watered"})
    assert watered.status_code == 201
    fertilized = client.post(url + "/care", json={"request_id": str(uuid4()), "action": "fertilized"})
    assert fertilized.status_code == 201
    events = client.get(url + "/history").json()["events"]
    assert len(events) == 3
    for action in ("soil_changed", "repotted", "examined"):
        request = {"request_id": str(uuid4()), "action": action, "note": "رسیدگی تازه"}
        saved = client.post(url + "/care", json=request)
        assert saved.status_code == 201 and saved.json()["event"]["action"] == action
        assert client.post(url + "/care", json=request).json() == saved.json()
        assert client.post(url + "/care", json={**request, "action": "watered"}).status_code == 409
    assert len(client.get(url + "/history").json()["events"]) == 6
    assert client.post(url + "/care", json={"request_id": str(uuid4()), "action": "invalid"}).status_code == 422
    assert all(e["actor_name"] == "سعید" and e["performed_at"].endswith("+00:00") for e in events)
    assert client.post(base, json=data).json()["plant"]["name"] == "پتوس بزرگ"
    assert client.delete(url).status_code == 204
    assert client.delete(url).status_code == 204
    assert client.get(base).json()["plants"] == []
    for suffix in ("", "/history"):
        assert client.get(url + suffix).status_code == 404
    assert client.post(url + "/care", json=care).status_code == 404
    assert client.post(base, json=data).status_code == 409


def test_list_orders_newest_first_without_schedules(client, monkeypatch):
    register(client)
    base = f"/api/families/{create(client)}/plants"
    monkeypatch.setattr("app.plants.service.now", lambda: datetime(2026, 1, 1, tzinfo=UTC))
    first = client.post(base, json=payload()).json()["plant"]
    monkeypatch.setattr("app.plants.service.now", lambda: datetime(2026, 1, 2, tzinfo=UTC))
    second = client.post(base, json=payload()).json()["plant"]
    listed = client.get(base).json()
    assert listed["plants"] == [second, first]
    assert listed["timezone"] == "Asia/Tehran"


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


def test_validation_rejects_removed_schedules_and_migration(client):
    register(client)
    base = f"/api/families/{create(client)}/plants"
    for changes in ({"name": " "}, {"location": ""}, {"note": "x" * 2001},
                    {"soil_interval": 3}, {"soil_due": "2026-01-01"},
                    {"fertilizer_interval": None}, {"fertilizer_due": None}, {"user_id": str(uuid4())}):
        response = client.post(base, json=payload(**changes))
        assert response.status_code == 422, response.text
    row = client.post(base, json=payload()).json()["plant"]
    url = f"{base}/{row['id']}"
    assert client.post(url + "/care", json={"request_id": str(uuid4()), "action": "fertilized"}).status_code == 201
    fields = {k: v for k, v in payload().items() if k != "request_id"}
    assert client.put(url, json={**fields, "soil_interval": 3}).status_code == 422
    assert client.get(base + "?offset=-1").status_code == 422
    command.check(Config("alembic.ini"))
    with pytest.raises(RuntimeError, match="Refusing"):
        command.downgrade(Config("alembic.ini"), "d58764dc192a")


@pytest.mark.parametrize("app", ["d58764dc192a"], indirect=True)
def test_upgrade_preserves_plant_photo_and_history(client, app):
    user = register(client)
    family = UUID(create(client))
    plant_id, event_id, request_id = uuid4(), uuid4(), uuid4()
    actor_id = UUID(user["id"])
    note = "رسیدگی قبل از مهاجرت"
    digest = fingerprint({"plant_id": plant_id, "actor_id": actor_id, "action": "fertilized", "note": note})
    with app.state.engine.begin() as db:
        db.execute(text("""
            INSERT INTO plants.plants
                (id, family_id, name, species, location, note, soil_interval, soil_due,
                 fertilizer_interval, fertilizer_due, created_by, request_id, request_fingerprint,
                 created_at, photo_key, photo_digest)
            VALUES (:id, :family, 'قدیمی', 'پتوس', 'پذیرایی', '', 3, '2026-01-01',
                    20, '2026-02-01', :actor, :request, :fingerprint, now(), :key, :photo_digest)
        """), {"id": plant_id, "family": family, "actor": actor_id, "request": uuid4(),
                 "fingerprint": "a" * 64, "key": f"plants/{family}/{plant_id}/old.jpg", "photo_digest": "b" * 64})
        db.execute(text("""
            INSERT INTO plants.care_events
                (id, family_id, plant_id, actor_id, action, note, performed_at,
                 next_due, request_id, request_fingerprint)
            VALUES (:id, :family, :plant, :actor, 'fertilized', :note,
                    '2026-01-01T21:00:00+00:00', '2026-01-22', :request, :fingerprint)
        """), {"id": event_id, "family": family, "plant": plant_id, "actor": actor_id,
                 "note": note, "request": request_id, "fingerprint": digest})
    command.upgrade(Config("alembic.ini"), "head")
    command.check(Config("alembic.ini"))
    base = f"/api/families/{family}/plants/{plant_id}"
    plant = client.get(base).json()["plant"]
    assert plant["name"] == "قدیمی" and plant["photo_url"].endswith("?v=" + "b" * 64)
    assert "soil" not in plant and "fertilizer" not in plant
    event = client.get(base + "/history").json()["events"][0]
    assert event["id"] == str(event_id) and event["note"] == note
    assert event["performed_at"] == "2026-01-01T21:00:00+00:00" and "next_due" not in event
    retry = client.post(base + "/care", json={"request_id": str(request_id), "action": "fertilized", "note": note})
    assert retry.status_code == 201 and retry.json()["event"]["id"] == str(event_id)
    assert len(client.get(base + "/history").json()["events"]) == 1
