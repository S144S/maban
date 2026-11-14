from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from test_families import accept, account, create, invite
from test_income import payload
from test_users import register


def location(client, family, **changes):
    return client.post(f"/api/families/{family}/money-locations", json={
        "name": "بانک ملی", "request_id": str(uuid4()), **changes,
    })


def test_locations_validation_and_idempotency(client):
    register(client)
    family = create(client)
    request = str(uuid4())
    result = location(client, family, name="  بانک ملی  ", request_id=request)
    assert result.status_code == 201, result.text
    assert result.json()["location"]["name"] == "بانک ملی"
    assert location(client, family, request_id=request).json() == result.json()
    assert location(client, family, name="پول نقد", request_id=request).status_code == 409
    assert location(client, family).status_code == 409
    for name in ("", "   ", "x" * 81):
        assert location(client, family, name=name).status_code == 422
    assert len(client.get(f"/api/families/{family}/money-locations").json()["locations"]) == 1


def test_location_permissions_and_income_attribution(client, app):
    owner = register(client)
    family = create(client)
    url = f"/api/families/{family}/money-locations"
    bank = location(client, family).json()["location"]
    viewer, _ = account(app, "09123456780")
    stranger, other_user = account(app, "09123456781")
    editor, _ = account(app, "09123456782")
    with viewer, stranger, editor:
        assert accept(viewer, invite(client, family)["token"]).status_code == 200
        invitation = client.post(f"/api/families/{family}/invitations", json={"relationship": "friend"}).json()
        assert accept(editor, invitation["token"]).status_code == 200
        assert len(viewer.get(url).json()["locations"]) == 1
        assert location(viewer, family, name="پول نقد").status_code == 403
        assert location(editor, family, name="پول نقد").status_code == 403
        assert stranger.get(url).status_code == 404
        assert location(stranger, family).status_code == 404
        other = create(stranger)
        assert stranger.get(f"/api/families/{other}/money-locations").json()["locations"] == []
        assert stranger.post(f"/api/families/{other}/income", json=payload(other_user, location_id=bank["id"])).status_code == 404
    income_url = f"/api/families/{family}/income"
    data = payload(owner, location_id=bank["id"])
    result = client.post(income_url, json=data)
    assert result.status_code == 201, result.text
    assert result.json()["entry"]["location_name"] == "بانک ملی"
    assert client.post(income_url, json=data).json() == result.json()
    assert client.post(income_url, json={**data, "location_id": None}).status_code == 409
    assert client.post(income_url, json=payload(owner, location_id=str(uuid4()))).status_code == 404
    legacy = client.post(income_url, json=payload(owner))
    assert legacy.status_code == 201
    assert legacy.json()["entry"]["location_id"] is None
    assert client.get(income_url).json()["total_toman"] == "30000000"


@pytest.mark.usefixtures("before_signup_gifts")
def test_location_migration_preserves_existing_income(client):
    user = register(client)
    family = create(client)
    url = f"/api/families/{family}/income"
    entry = client.post(url, json=payload(user)).json()["entry"]
    config = Config("alembic.ini")
    command.downgrade(config, "c75fa230b412")
    command.upgrade(config, "head")
    stored = client.get(url).json()["entries"][0]
    assert stored["id"] == entry["id"]
    assert stored["amount_toman"] == entry["amount_toman"]
    assert stored["location_id"] is None
    assert stored["location_name"] is None
    command.check(config)


def test_location_schema_ownership():
    from app.money_locations.persistence import TABLES
    assert all(t.schema == "money_locations" and not t.foreign_keys for t in TABLES)


def test_rename_account_validation_and_income_history(client):
    user = register(client)
    family = create(client)
    bank = location(client, family).json()["location"]
    location(client, family, name="پول نقد")
    url = f"/api/families/{family}/money-locations/{bank['id']}"
    income_url = f"/api/families/{family}/income"
    original_payload = payload(user, location_id=bank["id"])
    original = client.post(income_url, json=original_payload).json()
    for name in ("", "   ", "x" * 81):
        assert client.patch(url, json={"name": name}).status_code == 422
    assert client.patch(url, json={"name": " پول نقد "}).status_code == 409
    renamed = client.patch(url, json={"name": "  بانک ملت  "})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["location"]["id"] == bank["id"]
    assert renamed.json()["location"]["name"] == "بانک ملت"
    assert client.patch(url, json={"name": "بانک ملت"}).json() == renamed.json()
    assert client.post(income_url, json=original_payload).json() == original
    new_entry = client.post(income_url, json=payload(user, location_id=bank["id"])).json()["entry"]
    assert new_entry["location_name"] == "بانک ملت"
    assert client.get(income_url).json()["count"] == 2
    assert client.get(f"/api/families/{family}/money-locations").json()["locations"][0]["name"] == "بانک ملت"
    assert client.patch(f"/api/families/{family}/money-locations/{uuid4()}", json={"name": "نام"}).status_code == 404


def test_rename_account_permissions(client, app):
    register(client)
    family = create(client)
    bank = location(client, family).json()["location"]
    url = f"/api/families/{family}/money-locations/{bank['id']}"
    viewer, _ = account(app, "09123456780")
    stranger, _ = account(app, "09123456781")
    editor, _ = account(app, "09123456782")
    with viewer, stranger, editor:
        assert accept(viewer, invite(client, family)["token"]).status_code == 200
        assert viewer.patch(url, json={"name": "جدید"}).status_code == 403
        assert stranger.patch(url, json={"name": "جدید"}).status_code == 404
        other = create(stranger)
        assert stranger.patch(f"/api/families/{other}/money-locations/{bank['id']}", json={"name": "جدید"}).status_code == 404
        invitation = client.post(f"/api/families/{family}/invitations", json={"relationship": "friend"}).json()
        assert accept(editor, invitation["token"]).status_code == 200
        assert editor.patch(url, json={"name": "بانک ملت"}).status_code == 403


def test_delete_account_preserves_income_and_retries(client, app):
    from uuid import UUID

    from sqlalchemy import select

    from app.money_locations.models import MoneyLocation

    user = register(client)
    family = create(client)
    bank = location(client, family).json()["location"]
    url = f"/api/families/{family}/money-locations/{bank['id']}"
    income_url = f"/api/families/{family}/income"
    data = payload(user, location_id=bank["id"])
    original = client.post(income_url, json=data).json()
    before = client.get(income_url).json()
    assert client.delete(url).status_code == 204
    assert client.delete(url).status_code == 204
    assert client.get(f"/api/families/{family}/money-locations").json()["locations"] == []
    assert client.get(income_url).json() == before
    assert client.post(income_url, json=data).json() == original
    assert client.post(income_url, json={**data, "amount_toman": 10}).status_code == 409
    assert client.post(income_url, json=payload(user, location_id=bank["id"])).status_code == 404
    assert client.patch(url, json={"name": "جدید"}).status_code == 404
    with app.state.sessions() as db:
        stored = db.scalar(select(MoneyLocation).where(MoneyLocation.id == UUID(bank["id"])))
        assert stored is not None and stored.deleted_at is not None
        assert stored.name == bank["name"]
    assert client.delete(f"/api/families/{family}/money-locations/{uuid4()}").status_code == 404


def test_delete_account_permissions(client, app):
    register(client)
    family = create(client)
    bank = location(client, family).json()["location"]
    url = f"/api/families/{family}/money-locations/{bank['id']}"
    viewer, _ = account(app, "09123456780")
    stranger, _ = account(app, "09123456781")
    editor, _ = account(app, "09123456782")
    with viewer, stranger, editor:
        assert accept(viewer, invite(client, family)["token"]).status_code == 200
        assert viewer.delete(url).status_code == 403
        assert stranger.delete(url).status_code == 404
        other = create(stranger)
        assert stranger.delete(f"/api/families/{other}/money-locations/{bank['id']}").status_code == 404
        invitation = client.post(f"/api/families/{family}/invitations", json={"relationship": "friend"}).json()
        assert accept(editor, invitation["token"]).status_code == 200
        assert editor.delete(url).status_code == 403
