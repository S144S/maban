from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import UUID

import pytest
from conftest import HEADERS
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from test_users import register

from app.families.models import Family, Invitation, Membership
from app.families.service import now


def account(app, phone):
    client = TestClient(app, headers=HEADERS)
    user = register(client, phone)
    return client, user


def create(client):
    result = client.post("/api/families", json={"name": "خانوادهٔ ما"})
    assert result.status_code == 201, result.text
    return result.json()["family"]["id"]


def invite(client, family_id, relationship="friend"):
    result = client.post(f"/api/families/{family_id}/invitations", json={"relationship": relationship})
    assert result.status_code == 201, result.text
    return result.json()


def accept(client, token):
    return client.post("/api/families/invitations/accept", json={"token": token})


def test_create_membership_and_one_owned_family(client, app):
    user = register(client)
    family_id = create(client)
    assert client.post("/api/families", json={"name": "دوم"}).status_code == 409
    data = client.get(f"/api/families/{family_id}").json()
    assert data["family"]["owner_id"] == user["id"]
    assert data["members"][0]["relationship"] is None
    assert data["members"][0]["name"] == "سعید آزمایشی"
    assert "phone" not in data["members"][0]
    assert len(client.get("/api/families").json()["families"]) == 1
    with app.state.sessions() as db:
        assert db.scalar(select(Family)).owner_id == UUID(user["id"])
        assert db.scalar(select(Membership)).family_id == UUID(family_id)


@pytest.mark.parametrize("relationship", ["spouse", "child", "friend"])
def test_invite_join_and_replay(client, app, relationship):
    register(client)
    family_id = create(client)
    invitation = invite(client, family_id, relationship)
    with account(app, "09123456780")[0] as member, account(app, "09123456781")[0] as stranger:
        preview = member.post("/api/families/invitations/preview", json={"token": invitation["token"]})
        assert preview.json()["relationship"] == relationship
        assert member.get(f"/api/families/{family_id}").status_code == 404
        assert accept(member, invitation["token"]).status_code == 200
        assert accept(member, invitation["token"]).status_code == 200
        assert accept(stranger, invitation["token"]).status_code == 409
        detail = member.get(f"/api/families/{family_id}").json()
        assert len(detail["members"]) == 2
        assert detail["members"][1]["relationship"] == relationship
        assert (
            member.post(f"/api/families/{family_id}/invitations", json={"relationship": "friend"}).status_code
            == 403
        )
        assert member.get(f"/api/families/{family_id}/invitations").status_code == 403
        # An invited member can still create their own family.
        create(member)
        assert len(member.get("/api/families").json()["families"]) == 2
    with app.state.sessions() as db:
        row = db.scalar(select(Invitation))
        assert invitation["token"] != row.token_hash
        assert row.accepted_at is not None
    listing = client.get(f"/api/families/{family_id}/invitations").json()
    assert "token" not in listing["invitations"][0]
    assert "token_hash" not in listing["invitations"][0]


def test_ownership_revocation_expiry_and_validation(client, app):
    register(client)
    family_id = create(client)
    invitation = invite(client, family_id)
    with account(app, "09123456780")[0] as stranger:
        other_id = create(stranger)
        assert stranger.get(f"/api/families/{family_id}").status_code == 404
        assert (
            stranger.delete(
                f"/api/families/{family_id}/invitations/{invitation['invitation']['id']}"
            ).status_code
            == 404
        )
        assert (
            stranger.delete(
                f"/api/families/{other_id}/invitations/{invitation['invitation']['id']}"
            ).status_code
            == 404
        )
        assert (
            client.delete(
                f"/api/families/{family_id}/invitations/{invitation['invitation']['id']}"
            ).status_code
            == 200
        )
        assert accept(stranger, invitation["token"]).status_code == 410
        expired = invite(client, family_id)
        with app.state.sessions.begin() as db:
            db.execute(update(Invitation).values(expires_at=now() - timedelta(seconds=1)))
        assert accept(stranger, expired["token"]).status_code == 410
        assert accept(stranger, "a" * 43).status_code == 404
        assert accept(stranger, "short").status_code == 422
    for role in ("owner", "admin", "", "spouse OR 1=1"):
        assert (
            client.post(f"/api/families/{family_id}/invitations", json={"relationship": role}).status_code
            == 422
        )
    assert client.post("/api/families", json={"name": "   "}).status_code == 422
    assert client.post("/api/families", json={"name": "x", "owner_id": "x"}).status_code == 422


def test_owner_cannot_consume_own_invitation(client, app):
    register(client)
    family_id = create(client)
    invitation = invite(client, family_id)
    assert accept(client, invitation["token"]).status_code == 409
    with account(app, "09123456780")[0] as member:
        assert accept(member, invitation["token"]).status_code == 200


def test_concurrent_invitation_acceptance_has_one_winner(client, app):
    register(client)
    family_id = create(client)
    invitation = invite(client, family_id)
    with account(app, "09123456780")[0] as first, account(app, "09123456781")[0] as second:
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda c: accept(c, invitation["token"]), [first, second]))
        assert sorted(r.status_code for r in responses) == [200, 409]
    assert len(client.get(f"/api/families/{family_id}").json()["members"]) == 2


def test_concurrent_family_creation_and_invite_throttle(client, app):
    register(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post("/api/families", json={"name": "خانواده"}), range(2)))
    assert sorted(r.status_code for r in responses) == [201, 409]
    family_id = next(r.json()["family"]["id"] for r in responses if r.status_code == 201)
    for _ in range(20):
        invite(client, family_id)
    assert (
        client.post(f"/api/families/{family_id}/invitations", json={"relationship": "friend"}).status_code
        == 429
    )


def test_families_require_authentication_and_active_user(client, app):
    assert client.get("/api/families").status_code == 401
    assert client.post("/api/families", json={"name": "x"}).status_code == 401
    assert client.post("/api/families/invitations/preview", json={"token": "a" * 43}).status_code == 401
    register(client)
    family_id = create(client)
    client.post("/api/auth/logout")
    assert client.get(f"/api/families/{family_id}").status_code == 401


def test_family_schema_has_no_cross_module_foreign_keys():
    for model in (Family, Membership, Invitation):
        assert model.__table__.schema == "families"
        for fk in model.__table__.foreign_keys:
            assert fk.column.table.schema == "families"


def test_full_access_can_manage_invitations_and_view_cannot(client, app):
    register(client)
    family_id = create(client)
    assert client.get(f"/api/families/{family_id}").json()["members"][0]["access"] == "full"
    invitation = client.post(
        f"/api/families/{family_id}/invitations", json={"relationship": "friend", "access": "full"}
    ).json()
    with account(app, "09123456780")[0] as manager, account(app, "09123456781")[0] as viewer:
        assert (
            manager.post("/api/families/invitations/preview", json={"token": invitation["token"]}).json()[
                "access"
            ]
            == "full"
        )
        assert accept(manager, invitation["token"]).status_code == 200
        issued = invite(manager, family_id)
        assert issued["invitation"]["access"] == "view"
        assert accept(viewer, issued["token"]).status_code == 200
        assert viewer.get(f"/api/families/{family_id}").status_code == 200
        pending = invite(manager, family_id)
        path = f"/api/families/{family_id}/invitations/{pending['invitation']['id']}"
        assert viewer.delete(path).status_code == 403
        assert (
            viewer.post(
                f"/api/families/{family_id}/invitations", json={"relationship": "friend", "access": "full"}
            ).status_code
            == 403
        )
        assert manager.get(f"/api/families/{family_id}/invitations").status_code == 200
        assert manager.delete(path).status_code == 200
    assert (
        client.post(
            f"/api/families/{family_id}/invitations", json={"relationship": "friend", "access": "admin"}
        ).status_code
        == 422
    )
