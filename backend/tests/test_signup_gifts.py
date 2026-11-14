from concurrent.futures import ThreadPoolExecutor
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select
from test_families import accept, account, create, invite
from test_users import PASSWORD, register, request, verify

from app.families.models import Family, Membership
from app.families.service import Families
from app.users.models import User
from app.wallets.models import Entry, SignupGift, Wallet
from app.wallets.public import claim_signup_gift
from app.wallets.service import reserve_sms


def balance(client, family_id):
    return client.get(f"/api/families/{family_id}/wallet").json()["balance_toman"]


def test_registration_waits_for_first_family_and_gift_is_spendable(client, app):
    user_id = UUID(register(client)["id"])
    with app.state.sessions() as db:
        assert db.get(SignupGift, user_id).family_id is None
        assert db.scalar(select(func.count()).select_from(Entry)) == 0
    family_id = create(client)
    assert balance(client, family_id) == 5000
    with app.state.sessions.begin() as db:
        assert db.get(SignupGift, user_id).family_id == UUID(family_id)
        assert reserve_sms(db, UUID(family_id), uuid4(), 500)
    assert balance(client, family_id) == 4500
    assert client.post("/api/families", json={"name": "دوباره"}).status_code == 409
    assert balance(client, family_id) == 4500


def test_invited_registration_credits_shared_family_once(client, app):
    register(client)
    family_id = create(client)
    token = invite(client, family_id)["token"]
    with account(app, "09123456780")[0] as member:
        assert accept(member, "a" * 43).status_code == 404
        assert balance(client, family_id) == 5000
        assert accept(member, token).status_code == 200
        assert accept(member, token).status_code == 200
        assert balance(member, family_id) == 10000
        own = create(member)
        assert balance(member, own) == 0
        assert balance(member, family_id) == 10000
    rows = client.get(f"/api/families/{family_id}/wallet/entries").json()["entries"]
    assert len(rows) == 2
    assert all(r["kind"] == "signup_gift" and r["amount_toman"] == 5000 for r in rows)


def test_parallel_first_memberships_only_credit_one_family(client, app):
    register(client)
    first = create(client)
    first_token = invite(client, first)["token"]
    with account(app, "09123456780")[0] as owner, account(app, "09123456781")[0] as member:
        second = create(owner)
        second_token = invite(owner, second)["token"]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda token: accept(member, token), [first_token, second_token]))
        assert all(r.status_code == 200 for r in results)
        assert sorted([balance(member, first), balance(member, second)]) == [5000, 10000]
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Entry)) == 3
        assert db.scalar(select(func.sum(Entry.amount_toman))) == 15000
        assert db.scalar(select(func.sum(Wallet.balance_toman))) == 15000


def test_membership_and_gift_rollback_together_and_retry_succeeds(client, app):
    user_id = UUID(register(client)["id"])
    def fail_after_credit(db, user_id, family_id):
        claim_signup_gift(db, user_id, family_id)
        raise RuntimeError("injected failure")
    with pytest.raises(RuntimeError, match="injected failure"), app.state.sessions.begin() as db:
        Families(db, on_member_joined=fail_after_credit).create(user_id, "آزمون")
    with app.state.sessions() as db:
        assert db.get(SignupGift, user_id).family_id is None
        for model in (Family, Membership, Wallet, Entry):
            assert db.scalar(select(func.count()).select_from(model)) == 0
    assert balance(client, create(client)) == 5000


@pytest.mark.parametrize("app", ["ce965430eb12"], indirect=True)
def test_migration_does_not_grant_existing_registrations(client, app):
    app.state.on_user_registered = None
    app.state.on_family_member_joined = None
    old_user = UUID(register(client)["id"])
    family_id = create(client)
    command.upgrade(Config("alembic.ini"), "head")
    command.check(Config("alembic.ini"))
    with app.state.sessions.begin() as db:
        claim_signup_gift(db, old_user, UUID(family_id))
        assert db.get(SignupGift, old_user) is None
    assert balance(client, family_id) == 0


def test_downgrade_preserves_unclaimed_gift_entitlement(client, app):
    user_id = UUID(register(client)["id"])
    with pytest.raises(RuntimeError, match="entitlements must be preserved"):
        command.downgrade(Config("alembic.ini"), "ce965430eb12")
    with app.state.sessions() as db:
        assert db.get(SignupGift, user_id) is not None


def test_registration_and_entitlement_rollback_together(client, app):
    proof = verify(client, request(client)).json()["proof"]
    data = {"proof": proof, "first_name": "آزمون", "last_name": "هدیه", "password": PASSWORD}
    original = app.state.on_user_registered
    def fail_after_eligibility(db, user_id):
        original(db, user_id)
        raise RuntimeError("registration failure")
    app.state.on_user_registered = fail_after_eligibility
    with pytest.raises(RuntimeError, match="registration failure"):
        client.post("/api/auth/register", json=data)
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0
        assert db.scalar(select(func.count()).select_from(SignupGift)) == 0
    app.state.on_user_registered = original
    assert client.post("/api/auth/register", json=data).status_code == 201
    assert balance(client, create(client)) == 5000
