from uuid import uuid4

from alembic import command
from alembic.config import Config
from test_expenses import payload
from test_families import accept, account, create, invite
from test_users import register


def category(client, family, **changes):
    return client.post(f"/api/families/{family}/expenses/categories", json={
        "name": "درمان", "request_id": str(uuid4()), **changes,
    })


def test_category_validation_and_retry(client):
    register(client)
    family = create(client)
    request_id = str(uuid4())
    response = category(client, family, name="  درمان  ", request_id=request_id)
    assert response.status_code == 201, response.text
    assert response.json()["category"]["name"] == "درمان"
    assert category(client, family, request_id=request_id).json() == response.json()
    assert category(client, family, name="سفر", request_id=request_id).status_code == 409
    assert category(client, family).status_code == 409
    for name in ("", "  ", "x" * 81):
        assert category(client, family, name=name).status_code == 422
    assert len(client.get(f"/api/families/{family}/expenses/categories").json()["categories"]) == 2


def test_category_owner_management_member_use_and_family_isolation(client, app):
    owner = register(client)
    family = create(client)
    saved = category(client, family).json()["category"]
    path = f"/api/families/{family}/expenses"
    member, user = account(app, "09123456780")
    stranger, other = account(app, "09123456781")
    with member, stranger:
        assert accept(member, invite(client, family)["token"]).status_code == 200
        assert saved in member.get(path + "/categories").json()["categories"]
        assert category(member, family, name="سفر").status_code == 403
        assert category(stranger, family).status_code == 404
        assert stranger.get(path + "/categories").status_code == 404
        data = payload(user, category_id=saved["id"])
        del data["category"]
        result = member.post(path, json=data)
        assert result.status_code == 201, result.text
        assert result.json()["entry"]["category_id"] == saved["id"]
        assert result.json()["entry"]["category_name"] == "درمان"
        assert member.post(path, json=data).json() == result.json()
        assert member.post(path, json={**data, "amount_toman": 600}).status_code == 409
        assert client.get(path).json()["total_toman"] == "500"
        assert member.post(path, json={**data, "category_id": str(uuid4())}).status_code == 409
        other_family = create(stranger)
        assert stranger.get(f"/api/families/{other_family}/expenses/categories").json()["categories"][0]["name"] == "سایر"
        assert stranger.post(f"/api/families/{other_family}/expenses", json={**data, "paid_by_member_id": other["id"]}).status_code == 404
        assert member.post(path, json={**data, "category": "home"}).status_code == 422
        assert member.post(path, json={**data, "category_id": None}).status_code == 422
    legacy = client.post(path, json=payload(owner))
    assert legacy.status_code == 201
    assert legacy.json()["entry"]["category_name"] == "خرید روزمره"


def test_category_migration_preserves_expenses(client):
    user = register(client)
    family = create(client)
    path = f"/api/families/{family}/expenses"
    original = client.post(path, json=payload(user)).json()["entry"]
    config = Config("alembic.ini")
    command.downgrade(config, "56ea312943ab")
    command.upgrade(config, "head")
    command.check(config)
    assert client.get(path).json()["entries"] == [original]
    assert client.get(path).json()["total_toman"] == "500"


def test_categories_require_login(client):
    path = f"/api/families/{uuid4()}/expenses/categories"
    assert client.get(path).status_code == 401
    assert client.post(path, json={"name": "درمان", "request_id": str(uuid4())}).status_code == 401


def test_category_icons_validation_persistence_and_retry(client):
    register(client)
    family = create(client)
    request_id = str(uuid4())
    response = category(client, family, icon="heart-pulse", request_id=request_id)
    assert response.status_code == 201
    assert response.json()["category"]["icon"] == "heart-pulse"
    assert category(client, family, icon="heart-pulse", request_id=request_id).json() == response.json()
    assert category(client, family, icon="car", request_id=request_id).status_code == 409
    assert any(c["icon"] == "heart-pulse" for c in client.get(f"/api/families/{family}/expenses/categories").json()["categories"])
    for icon in ("unknown", "", "<svg>", None):
        assert category(client, family, icon=icon).status_code == 422


def test_icon_migration_defaults_existing_categories(client):
    register(client)
    family = create(client)
    original = category(client, family).json()["category"]
    assert original["icon"] == "tag"
    config = Config("alembic.ini")
    command.downgrade(config, "67fb423054bc")
    command.upgrade(config, "head")
    command.check(config)
    assert original in client.get(f"/api/families/{family}/expenses/categories").json()["categories"]


def test_category_edit_delete_reassignment_and_retry(client, app):
    user = register(client)
    family = create(client)
    path = f"/api/families/{family}/expenses"
    defaults = client.get(path + "/categories").json()["categories"]
    assert len(defaults) == 1
    default = defaults[0]
    assert default["name"] == "سایر" and default["is_default"]
    assert client.get(path + "/categories").json()["categories"] == defaults
    saved = category(client, family).json()["category"]
    target = path + "/categories/" + saved["id"]
    data = payload(user, category_id=saved["id"])
    del data["category"]
    original = client.post(path, json=data).json()["entry"]
    member, _ = account(app, "09123456780")
    with member:
        accept(member, invite(client, family)["token"])
        assert member.patch(target, json={"name": "سفر", "icon": "plane"}).status_code == 403
        assert member.delete(target).status_code == 403
    assert client.patch(target, json={"name": "سایر"}).status_code == 409
    assert client.patch(target, json={"name": "سفر", "icon": "plane"}).status_code == 200
    retry = client.post(path, json=data)
    assert retry.status_code == 201
    assert retry.json()["entry"]["category_name"] == "سفر"
    assert client.delete(target).status_code == 204
    entries = client.get(path).json()
    assert entries["total_toman"] == "500"
    entry = entries["entries"][0]
    assert entry["id"] == original["id"]
    assert entry["category_id"] == default["id"] and entry["category_name"] == "سایر"
    assert client.post(path, json=data).json()["entry"] == entry
    assert client.post(path, json={**data, "request_id": str(uuid4())}).status_code == 404
    assert client.post(path, json={**data, "amount_toman": 999}).status_code == 409
    assert client.patch(path + "/categories/" + default["id"], json={"name": "تغییر"}).status_code == 409
    assert client.delete(path + "/categories/" + default["id"]).status_code == 409
    assert client.get(path + "/categories").json()["categories"] == defaults
