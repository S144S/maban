from uuid import uuid4

from test_families import accept, account, create, invite
from test_users import register


def payload(user, **overrides):
    return {"amount_toman": 500, "title": "خرید", "category": "groceries",
            "paid_by_member_id": user["id"], "request_id": str(uuid4()), **overrides}


def test_persisted_family_balance_and_retries(client):
    user = register(client)
    family = create(client)
    url = f"/api/families/{family}/expenses"
    assert client.get(url).json()["total_toman"] == "0"
    data = payload(user)
    response = client.post(url, json=data)
    assert response.status_code == 201, response.text
    assert client.post(url, json=data).json() == response.json()
    assert client.post(url, json={**data, "amount_toman": 2}).status_code == 409
    assert client.get(url).json()["count"] == 1
    assert client.get(url).json()["total_toman"] == "500"
    assert client.get(url + "?offset=1").json()["total_toman"] == "500"
    income = f"/api/families/{family}/income"
    assert client.post(income, json={"amount_toman": 1000, "source": "gift",
        "from_member_id": user["id"], "request_id": str(uuid4())}).status_code == 201
    assert int(client.get(income).json()["total_toman"]) - int(client.get(url).json()["total_toman"]) == 500
    assert client.post(url, json=payload(user, amount_toman=1000)).status_code == 201
    assert int(client.get(income).json()["total_toman"]) - int(client.get(url).json()["total_toman"]) == -500


def test_expense_permissions_and_family_isolation(client, app):
    owner = register(client)
    family = create(client)
    url = f"/api/families/{family}/expenses"
    viewer, viewer_user = account(app, "09123456780")
    stranger, stranger_user = account(app, "09123456781")
    editor, _ = account(app, "09123456782")
    with viewer, stranger, editor:
        assert accept(viewer, invite(client, family)["token"]).status_code == 200
        invitation = client.post(f"/api/families/{family}/invitations",
            json={"relationship": "friend"}).json()
        assert accept(editor, invitation["token"]).status_code == 200
        assert stranger.get(url).status_code == 404
        assert stranger.post(url, json=payload(stranger_user)).status_code == 404
        assert viewer.post(url, json=payload(viewer_user)).status_code == 201
        assert client.post(url, json=payload(stranger_user)).status_code == 404
        assert editor.post(url, json=payload(owner)).status_code == 201
        assert viewer.get(url).json()["count"] == 2
        other = create(stranger)
        assert stranger.get(f"/api/families/{other}/expenses").json()["total_toman"] == "0"


def test_expense_validation(client):
    user = register(client)
    url = f"/api/families/{create(client)}/expenses"
    for change in ({"amount_toman": 0}, {"amount_toman": -1}, {"amount_toman": True},
                   {"amount_toman": 1.5}, {"amount_toman": 1000000000001},
                   {"title": "   "}, {"title": "x" * 81}, {"category": "invalid"},
                   {"description": "x" * 501}, {"paid_by_member_id": "invalid"}):
        assert client.post(url, json=payload(user, **change)).status_code == 422
    assert client.get(url).json()["count"] == 0
    assert client.post(url, json=payload(user, amount_toman=1000000000000)).status_code == 201


def test_expenses_schema_ownership():
    from app.expenses.persistence import TABLES

    for table in TABLES:
        assert table.schema == "expenses"
        assert not table.foreign_keys
