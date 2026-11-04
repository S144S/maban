from uuid import uuid4

from test_families import accept, account, create, invite
from test_users import register


def payload(user, **overrides):
    return {
        "amount_toman": 15000000,
        "source": "salary",
        "from_member_id": user["id"],
        "request_id": str(uuid4()),
        **overrides,
    }


def test_income_sources_totals_and_idempotency(client):
    user = register(client)
    family = create(client)
    url = f"/api/families/{family}/income"
    for source in ("salary", "subsidy", "voucher", "gift"):
        data = payload(user, source=source, description="  درآمد خانواده  ")
        response = client.post(url, json=data)
        assert response.status_code == 201, response.text
        assert response.json()["entry"]["description"] == "درآمد خانواده"
        assert client.post(url, json=data).json() == response.json()
        assert client.post(url, json={**data, "amount_toman": 1}).status_code == 409
    result = client.get(url).json()
    assert result["count"] == 4
    assert result["total_toman"] == "60000000"
    assert result["currency"] == "IRT"
    assert all(e["from_member_name"] == "سعید آزمایشی" for e in result["entries"])
    assert client.get(url + "?offset=4").json()["entries"] == []


def test_income_family_access_and_attribution(client, app):
    owner = register(client)
    family = create(client)
    url = f"/api/families/{family}/income"
    viewer, view_user = account(app, "09123456780")
    stranger, stranger_user = account(app, "09123456781")
    editor, _editor_user = account(app, "09123456782")
    with viewer, stranger, editor:
        assert accept(viewer, invite(client, family)["token"]).status_code == 200
        invitation = client.post(
            f"/api/families/{family}/invitations", json={"relationship": "friend", "access": "full"}
        ).json()
        assert accept(editor, invitation["token"]).status_code == 200
        assert stranger.get(url).status_code == 404
        assert stranger.post(url, json=payload(stranger_user)).status_code == 404
        assert viewer.post(url, json=payload(view_user)).status_code == 403
        assert client.post(url, json=payload(stranger_user)).status_code == 404
        assert editor.post(url, json=payload(view_user)).status_code == 201
        assert client.post(url, json=payload(owner)).status_code == 201
        assert viewer.get(url).json()["count"] == 2
        other = create(stranger)
        assert stranger.get(f"/api/families/{other}/income").json()["count"] == 0
        assert stranger.post(f"/api/families/{other}/income", json=payload(owner)).status_code == 404


def test_income_validation(client):
    user = register(client)
    url = f"/api/families/{create(client)}/income"
    for changes in (
        {"amount_toman": 0},
        {"amount_toman": -1},
        {"amount_toman": 1.5},
        {"amount_toman": True},
        {"amount_toman": 1000000000001},
        {"source": "other"},
        {"description": "x" * 501},
        {"from_member_id": "invalid"},
    ):
        assert client.post(url, json=payload(user, **changes)).status_code == 422
    assert client.post(url, json=payload(user, amount_toman=1000000000000)).status_code == 201
    assert client.get(url).json()["entries"][0]["description"] is None


def test_income_schema_ownership():
    from app.income.persistence import TABLES

    for table in TABLES:
        assert table.schema == "income"
        assert not table.foreign_keys
