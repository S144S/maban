from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from test_users import register
from test_wallets import family

from app.wallets.models import Topup, Wallet
from app.wallets.service import Wallets, settle_sms


@pytest.mark.parametrize("app", ["bc854329da01"], indirect=True)
def test_personal_money_requires_attribution_and_preserves_receipts_and_refunds(client, app):
    from test_wallets import Gateway

    # Exercise users registered before gift eligibility existed.
    app.state.on_user_registered = None
    app.state.on_family_member_joined = None
    user = UUID(register(client)["id"])
    target = UUID(family(client))
    credit, debit, pending = uuid4(), uuid4(), uuid4()
    authority = "A" + uuid4().hex + "000"
    now = datetime.now(UTC)
    with app.state.sessions.begin() as db:
        db.execute(text("INSERT INTO wallets.accounts VALUES (:user, 9500)"), {"user": user})
        for ref, kind, amount, balance, at in [
            (credit, "topup", 10000, 10000, now),
            (debit, "sms", -500, 9500, now + timedelta(seconds=1)),
        ]:
            db.execute(text("INSERT INTO wallets.entries VALUES (:id,:user,:kind,:ref,:amount,:balance,:at)"),
                       {"id": uuid4(), "user": user, "kind": kind, "ref": ref, "amount": amount,
                        "balance": balance, "at": at})
        db.execute(text("INSERT INTO wallets.topups "
                        "(id,user_id,request_id,amount_toman,authority,status,created_at) "
                        "VALUES (:id,:user,:request,10000,:authority,'pending',:at)"),
                   {"id": pending, "user": user, "request": uuid4(), "authority": authority, "at": now})
    with pytest.raises(RuntimeError, match="Assign every personal wallet"):
        command.upgrade(Config("alembic.ini"), "head")
    with app.state.sessions.begin() as db:
        # The failed upgrade is transactional; no data or schema was partly moved.
        assert db.scalar(text("SELECT balance_toman FROM wallets.accounts")) == 9500
        db.execute(text("CREATE TABLE wallets.ownership_migration (user_id uuid PRIMARY KEY, family_id uuid NOT NULL)"))
        db.execute(text("INSERT INTO wallets.ownership_migration VALUES (:user,:family)"),
                   {"user": user, "family": target})
        second = uuid4()
        db.execute(text("INSERT INTO families.memberships (id,family_id,user_id,joined_at) "
                        "VALUES (:id,:family,:user,:at)"),
                   {"id": uuid4(), "family": target, "user": second, "at": now})
        db.execute(text("INSERT INTO wallets.accounts VALUES (:user,10000)"), {"user": second})
        db.execute(text("INSERT INTO wallets.entries VALUES (:id,:user,'topup',:ref,10000,10000,:at)"),
                   {"id": uuid4(), "user": second, "ref": uuid4(), "at": now + timedelta(seconds=2)})
        db.execute(text("INSERT INTO wallets.ownership_migration VALUES (:user,:family)"),
                   {"user": second, "family": target})
    command.upgrade(Config("alembic.ini"), "head")
    command.check(Config("alembic.ini"))
    gateway = Gateway()
    with app.state.sessions.begin() as db:
        assert db.get(Wallet, target).balance_toman == 19500
        assert db.get(Topup, pending).actor_user_id == user
        assert db.scalar(text("SELECT balance_toman FROM wallets_legacy.accounts WHERE user_id=:user"),
                         {"user": user}) == 9500
        assert db.scalar(text("SELECT balance_after FROM wallets.entries ORDER BY created_at DESC LIMIT 1")) == 19500
        settle_sms(db, debit, "skipped")
        settle_sms(db, debit, "skipped")
        assert db.get(Wallet, target).balance_toman == 20000
        Wallets(db, app.state.settings, gateway).verify(authority=authority)
        assert db.get(Wallet, target).balance_toman == 30000
    with pytest.raises(RuntimeError, match="Export and explicitly clear"):
        command.downgrade(Config("alembic.ini"), "bc854329da01")
