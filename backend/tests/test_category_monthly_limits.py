from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from test_expense_categories import category
from test_expenses import payload
from test_families import accept, account, create, invite
from test_users import register


def test_monthly_limits_set_read_edit_clear_and_no_spending_block(client, app):
    user = register(client)
    family = create(client)
    base = f"/api/families/{family}/expenses"
    saved = category(client, family).json()["category"]
    assert saved["monthly_limit_toman"] is None
    path = base + "/categories/" + saved["id"] + "/monthly-limit"
    body = {"monthly_limit_toman": 100}
    first = client.put(path, json=body)
    assert first.status_code == 200
    assert first.json()["category"]["monthly_limit_toman"] == 100
    assert client.put(path, json=body).json() == first.json()
    member, _ = account(app, "09123456780")
    stranger, _ = account(app, "09123456781")
    with member, stranger:
        assert accept(member, invite(client, family)["token"]).status_code == 200
        assert first.json()["category"] in member.get(base + "/categories").json()["categories"]
        assert member.put(path, json=body).status_code == 403
        assert stranger.put(path, json=body).status_code == 404
        other_family = create(stranger)
        other_path = f"/api/families/{other_family}/expenses/categories/{saved['id']}/monthly-limit"
        assert stranger.put(other_path, json=body).status_code == 404
    data = payload(user, category_id=saved["id"])
    del data["category"]
    assert client.post(base, json=data).status_code == 201
    assert client.get(base).json()["total_toman"] == "500"
    updated = client.patch(base + "/categories/" + saved["id"], json={"name": "سفر", "icon": "plane"})
    assert updated.json()["category"]["monthly_limit_toman"] == 100
    assert client.put(path, json={"monthly_limit_toman": 1000000000000}).status_code == 200
    assert client.put(path, json={"monthly_limit_toman": None}).json()["category"]["monthly_limit_toman"] is None
    assert client.put(path, json={"monthly_limit_toman": None}).status_code == 200


def test_monthly_limit_default_category_and_deletion(client):
    register(client)
    family = create(client)
    base = f"/api/families/{family}/expenses/categories"
    default = client.get(base).json()["categories"][0]
    path = base + "/" + default["id"]
    assert client.put(path + "/monthly-limit", json={"monthly_limit_toman": 2000}).status_code == 200
    assert client.delete(path).status_code == 409
    assert client.patch(path, json={"name": "تغییر"}).status_code == 409
    saved = category(client, family).json()["category"]
    custom = base + "/" + saved["id"]
    assert client.put(custom + "/monthly-limit", json={"monthly_limit_toman": 9000}).status_code == 200
    assert client.delete(custom).status_code == 204
    assert client.put(custom + "/monthly-limit", json={"monthly_limit_toman": 100}).status_code == 404
    assert client.get(base).json()["categories"][0]["monthly_limit_toman"] == 2000


def test_monthly_limit_validation_and_auth(client):
    path = f"/api/families/{uuid4()}/expenses/categories/{uuid4()}/monthly-limit"
    assert client.put(path, json={"monthly_limit_toman": 1}).status_code == 401
    register(client)
    family = create(client)
    saved = category(client, family).json()["category"]
    path = f"/api/families/{family}/expenses/categories/{saved['id']}/monthly-limit"
    for value in (0, -1, 1000000000001, 1.5, True, "100"):
        assert client.put(path, json={"monthly_limit_toman": value}).status_code == 422
    assert client.put(path, json={}).status_code == 422
    assert client.put(path, json={"monthly_limit_toman": 1, "name": "test"}).status_code == 422


@pytest.mark.usefixtures("before_signup_gifts")
def test_monthly_limit_migration_preserves_category_and_expenses(client):
    user = register(client)
    family = create(client)
    saved = category(client, family).json()["category"]
    base = f"/api/families/{family}/expenses"
    data = payload(user, category_id=saved["id"])
    del data["category"]
    original = client.post(base, json=data).json()
    config = Config("alembic.ini")
    command.downgrade(config, "89bd645276de")
    command.upgrade(config, "head")
    command.check(config)
    assert saved in client.get(base + "/categories").json()["categories"]
    assert client.post(base, json=data).json() == original
    assert client.get(base).json()["total_toman"] == "500"
