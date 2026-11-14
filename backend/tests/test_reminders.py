from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from test_families import accept, account, create, invite
from test_users import register


def payload(**changes):
    return {"title": "قسط وام", "due_at": "2030-03-21T09:00:00+03:30",
            "amount_toman": 2500000, "request_id": str(uuid4()), **changes}


def test_reminders_crud_retry_and_no_delivery(client):
    assert client.get("/api/reminders").status_code == 401
    register(client)
    data = payload(title="  قسط وام  ")
    result = client.post("/api/reminders", json=data)
    assert result.status_code == 201, result.text
    row = result.json()["reminder"]
    assert row["title"] == "قسط وام"
    assert row["delivery_status"] == "not_available"
    assert row["recurrence"] == "none"
    assert client.post("/api/reminders", json=data).json() == result.json()
    assert client.post("/api/reminders", json={**data, "amount_toman": 1}).status_code == 409
    assert len(client.get("/api/reminders").json()["reminders"]) == 1
    url = f"/api/reminders/{row['id']}"
    change = {"title": "قسط جدید", "due_at": "2030-04-21T18:30:00+03:30", "amount_toman": None}
    updated = client.put(url, json=change)
    assert updated.status_code == 200
    assert updated.json()["reminder"]["amount_toman"] is None
    # A delayed creation retry must not revert later edits or create another entry.
    assert client.post("/api/reminders", json=data).json() == updated.json()
    assert client.delete(url).status_code == 204
    assert client.delete(url).status_code == 204
    assert client.get("/api/reminders").json()["reminders"] == []
    assert client.put(url, json=change).status_code == 404
    assert client.post("/api/reminders", json=data).status_code == 409


def test_reminders_are_private_even_for_family_members(client, app):
    register(client)
    family = create(client)
    row = client.post("/api/reminders", json=payload()).json()["reminder"]
    other, _ = account(app, "09123456780")
    with other:
        assert accept(other, invite(client, family)["token"]).status_code == 200
        assert other.get("/api/reminders").json()["reminders"] == []
        url = f"/api/reminders/{row['id']}"
        body = payload()
        del body["request_id"]
        assert other.put(url, json=body).status_code == 404
        assert other.delete(url).status_code == 404
        assert other.post("/api/reminders", json=payload()).status_code == 201
    assert len(client.get("/api/reminders").json()["reminders"]) == 1


def test_reminder_validation(client):
    register(client)
    for changes in ({"title": " "}, {"title": "x" * 81}, {"amount_toman": 0},
                    {"amount_toman": -1}, {"amount_toman": 1.5}, {"amount_toman": True},
                    {"amount_toman": 1000000000001}, {"due_at": "2030-02-30T09:00:00Z"},
                    {"due_at": "2030-01-01T09:00:00"}, {"due_at": 123456},
                    {"due_at": "2200-01-01T00:00:00Z"}, {"user_id": str(uuid4())},
                    {"sms_enabled": True}, {"recurrence": "yearly"}, {"recurrence": None},
                    {"recurrence": 1}):
        response = client.post("/api/reminders", json=payload(**changes))
        assert response.status_code == 422, response.text
    assert client.post("/api/reminders", json=payload(amount_toman=None)).status_code == 201
    assert client.post("/api/reminders", json=payload(amount_toman=1000000000000)).status_code == 201
    assert client.get("/api/reminders?offset=-1").status_code == 422


@pytest.mark.usefixtures("before_signup_gifts")
def test_reminder_pagination_and_migration(client):
    register(client)
    config = Config("alembic.ini")
    command.downgrade(config, "9ace756387ef")
    command.upgrade(config, "head")
    command.check(config)
    for i in range(51):
        assert client.post("/api/reminders", json=payload(title=f"قسط {i}")).status_code == 201
    first = client.get("/api/reminders").json()
    last = client.get("/api/reminders?offset=50").json()
    assert len(first["reminders"]) == 50 and first["has_more"]
    assert len(last["reminders"]) == 1 and not last["has_more"]
    assert last["reminders"][0]["id"] not in {row["id"] for row in first["reminders"]}


def test_reminder_schema_ownership():
    from app.reminders.persistence import TABLES
    assert all(table.schema == "reminders" and not table.foreign_keys for table in TABLES)


def test_upcoming_window_recurrence_privacy_and_pagination(client, app, monkeypatch):
    import jdatetime

    from app.reminders import service

    now = datetime(2030, 3, 21, 5, 30, tzinfo=UTC)

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return now.astimezone(tz)

    monkeypatch.setattr(service, "datetime", Clock)
    assert client.get("/api/reminders/upcoming").status_code == 401
    register(client)
    expected = set()

    def add_at(when, **changes):
        result = client.post("/api/reminders", json=payload(due_at=when.isoformat(), **changes))
        assert result.status_code == 201, result.text
        return result.json()["reminder"]["id"]

    expected.add(add_at(now))
    expected.add(add_at(now + timedelta(hours=24)))
    add_at(now - timedelta(seconds=1))
    add_at(now + timedelta(hours=24, seconds=1))
    deleted = add_at(now + timedelta(hours=1))
    assert client.delete(f"/api/reminders/{deleted}").status_code == 204
    for recurrence, days in [("daily", 1), ("weekly", 7), ("fortnightly", 14)]:
        expected.add(add_at(now - timedelta(days=days) + timedelta(hours=2), recurrence=recurrence))
    previous_month = jdatetime.date(1408, 12, 1).togregorian()
    monthly_anchor = now.replace(year=previous_month.year, month=previous_month.month,
                                 day=previous_month.day) + timedelta(hours=3)
    expected.add(add_at(monthly_anchor, recurrence="monthly"))
    # A future anchor must not be advanced to its second occurrence.
    expected.add(add_at(now + timedelta(hours=4), recurrence="daily"))
    other, _ = account(app, "09123456780")
    with other:
        assert other.get("/api/reminders/upcoming").json()["reminders"] == []
        assert other.post("/api/reminders", json=payload(due_at=now.isoformat())).status_code == 201
    for index in range(46):
        expected.add(add_at(now + timedelta(minutes=index + 1)))
    first = client.get("/api/reminders/upcoming").json()
    second = client.get("/api/reminders/upcoming?offset=50").json()
    assert first["has_more"] and len(first["reminders"]) == 50
    assert not second["has_more"]
    rows = first["reminders"] + second["reminders"]
    assert {row["id"] for row in rows} == expected
    occurrences = [datetime.fromisoformat(row["occurrence_at"]) for row in rows]
    assert occurrences == sorted(occurrences)
    assert all(now <= value <= now + timedelta(hours=24) for value in occurrences)
    assert client.get("/api/reminders/upcoming?offset=-1").status_code == 422


def test_reminder_notes_persist_retry_and_preserve_legacy_edits(client):
    register(client)
    data = payload(note="  خاک رو قبل از آب دادن بررسی کنیم\nآب کم  ")
    response = client.post("/api/reminders", json=data)
    assert response.status_code == 201, response.text
    row = response.json()["reminder"]
    assert row["note"] == "خاک رو قبل از آب دادن بررسی کنیم\nآب کم"
    assert client.post("/api/reminders", json=data).json() == response.json()
    assert client.post("/api/reminders", json={**data, "note": "تغییر"}).status_code == 409
    assert client.get("/api/reminders").json()["reminders"][0]["note"] == row["note"]
    url = f"/api/reminders/{row['id']}"
    edit = {"title": "عنوان جدید", "due_at": data["due_at"]}
    legacy = client.put(url, json=edit).json()["reminder"]
    assert legacy["note"] == row["note"] and legacy["amount_toman"] == data["amount_toman"]
    updated = client.put(url, json={**edit, "note": "توضیح جدید"}).json()["reminder"]
    assert updated["note"] == "توضیح جدید"
    assert client.put(url, json={**edit, "note": None}).json()["reminder"]["note"] is None
    for invalid in ("x" * 2001, 123):
        assert client.post("/api/reminders", json=payload(note=invalid)).status_code == 422


def test_plant_reminders_preserve_links_and_retry_after_deletion(client):
    from test_plants import payload as plant_payload

    register(client)
    family = create(client)
    base = f"/api/families/{family}/plants"
    plant = client.post(base, json=plant_payload()).json()["plant"]
    data = payload(title="بررسی خاک · پتوس", amount_toman=None,
                   plant_family_id=family, plant_id=plant["id"])
    response = client.post("/api/reminders", json=data)
    assert response.status_code == 201, response.text
    reminder = response.json()["reminder"]
    url = f"/api/reminders/{reminder['id']}"
    assert reminder["plant_id"] == plant["id"] and reminder["plant_family_id"] == family
    assert client.post("/api/reminders", json=data).json() == response.json()
    assert client.post("/api/reminders", json={**data, "plant_id": str(uuid4())}).status_code == 409
    # Old clients preserve links when editing; explicit nulls detach them.
    legacy = {"title": "عنوان جدید", "due_at": data["due_at"], "amount_toman": None}
    assert client.put(url, json=legacy).json()["reminder"]["plant_id"] == plant["id"]
    assert client.delete(f"{base}/{plant['id']}").status_code == 204
    assert client.post("/api/reminders", json=data).status_code == 201
    assert client.post("/api/reminders", json={**data, "request_id": str(uuid4())}).status_code == 404
    assert client.put(url, json={**legacy, "plant_id": plant["id"], "plant_family_id": family}).status_code == 200
    detached = client.put(url, json={**legacy, "plant_id": None, "plant_family_id": None})
    assert detached.json()["reminder"]["plant_id"] is None
    assert len(client.get("/api/reminders").json()["reminders"]) == 1


def test_plant_reminder_reference_authorization(client, app):
    from test_plants import payload as plant_payload

    register(client)
    family = create(client)
    plant = client.post(f"/api/families/{family}/plants", json=plant_payload()).json()["plant"]
    data = payload(plant_family_id=family, plant_id=plant["id"])
    other, _ = account(app, "09123456780")
    with other:
        other_family = create(other)
        assert other.post("/api/reminders", json=data).status_code == 404
        assert client.post("/api/reminders", json={**data, "plant_family_id": other_family}).status_code == 404
        assert accept(other, invite(client, family)["token"]).status_code == 200
        assert other.post("/api/reminders", json=data).status_code == 201
        assert client.get("/api/reminders").json()["reminders"] == []
        own = client.post("/api/reminders", json=payload()).json()["reminder"]
        assert other.put(f"/api/reminders/{own['id']}", json={k: v for k, v in data.items() if k != "request_id"}).status_code == 404
        forged = {k: v for k, v in data.items() if k != "request_id"}
        assert client.put(f"/api/reminders/{own['id']}", json={**forged, "plant_family_id": other_family}).status_code == 404
        for changes in ({"plant_id": plant["id"]}, {"plant_family_id": family}):
            assert client.post("/api/reminders", json=payload(**changes)).status_code == 422


def test_recurrence_creation_editing_and_retries(client):
    register(client)
    for recurrence in ("daily", "weekly", "fortnightly", "monthly"):
        data = payload(recurrence=recurrence)
        created = client.post("/api/reminders", json=data)
        assert created.status_code == 201, created.text
        row = created.json()["reminder"]
        assert row["recurrence"] == recurrence
        assert client.post("/api/reminders", json=data).json() == created.json()
        assert client.post("/api/reminders", json={**data, "recurrence": "none"}).status_code == 409
        url = f"/api/reminders/{row['id']}"
        fields = {key: value for key, value in data.items() if key not in ("request_id", "recurrence")}
        # A legacy update preserves the recurrence preference.
        assert client.put(url, json=fields).json()["reminder"]["recurrence"] == recurrence
        assert client.put(url, json={**fields, "recurrence": "yearly"}).status_code == 422
        assert client.put(url, json={**fields, "recurrence": "weekly"}).json()["reminder"]["recurrence"] == "weekly"
        assert client.put(url, json={**fields, "recurrence": "none"}).json()["reminder"]["recurrence"] == "none"
    assert all(row["recurrence"] == "none" for row in client.get("/api/reminders").json()["reminders"])


@pytest.mark.usefixtures("before_signup_gifts")
def test_recurrence_migration_preserves_existing_reminders_and_retries(client):
    register(client)
    data = payload()
    created = client.post("/api/reminders", json=data).json()
    config = Config("alembic.ini")
    command.downgrade(config, "abdf867498f0")
    command.upgrade(config, "head")
    command.check(config)
    assert client.get("/api/reminders").json()["reminders"] == [created["reminder"]]
    assert client.post("/api/reminders", json=data).json() == created
    assert client.post("/api/reminders", json={**data, "recurrence": "none"}).json() == created
