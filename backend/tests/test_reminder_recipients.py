from concurrent.futures import ThreadPoolExecutor
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import delete, select, update
from test_families import accept, account, create, invite
from test_reminder_sms import NOW, Sender, enabled
from test_reminders import payload
from test_users import PHONE, register

from app.families.models import Membership
from app.reminders.models import Reminder, SmsAttempt
from app.reminders.public import schedule_sms
from app.sms import SmsRejected
from app.sms_worker import run_batch
from app.users.models import User
from app.wallets.models import Entry, Wallet


def setup_family(client, app):
    owner = register(client)
    family = create(client)
    member, user = account(app, "09123456780")
    assert accept(member, invite(client, family)["token"]).status_code == 200
    return owner, family, member, user


def add(client, family, recipients, **changes):
    return client.post("/api/reminders", json=payload(sms_family_id=family,
        recipient_user_ids=recipients, due_at=NOW.isoformat(), **changes))


def test_sends_and_bills_each_selected_member_once(client, app):
    owner, family, member, user = setup_family(client, app)
    result = add(client, family, [user["id"], user["id"]])
    assert result.status_code == 201
    reminder = result.json()["reminder"]
    assert reminder["recipient_user_ids"] == [user["id"]]
    assert member.get("/api/reminders").json()["reminders"] == []
    sender = Sender()
    with ThreadPoolExecutor(max_workers=2) as pool:
        counts = list(pool.map(lambda _: run_batch(app.state.sessions, enabled(), sender, now=NOW), range(2)))
    assert sum(counts) == 2
    assert sorted(call[0] for call in sender.calls) == sorted([PHONE, user["phone"]])
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 0
    with app.state.sessions() as db:
        assert db.get(Wallet, UUID(family)).balance_toman == 9000
        attempts = db.scalars(select(SmsAttempt)).all()
        assert {a.recipient_user_id for a in attempts} == {UUID(owner["id"]), UUID(user["id"])}
        assert db.get(Reminder, UUID(reminder["id"])).sms_status == "accepted"
    command.check(Config("alembic.ini"))


@pytest.mark.parametrize("recipients", [[str(uuid4())], [], ["self"]])
def test_recipients_require_same_family_and_exclude_self(client, app, recipients):
    owner = register(client)
    family = create(client)
    selected = [owner["id"]] if recipients == ["self"] else recipients
    response = add(client, family, selected)
    assert response.status_code == (201 if not selected else 422)
    if selected:
        assert client.get("/api/reminders").json()["reminders"] == []
    assert add(client, None, [str(uuid4())]).status_code == 422


@pytest.mark.parametrize("change", ["leave", "inactive", "remove_selection", "delete"])
def test_pending_recipient_jobs_are_rechecked_and_refunded(client, app, change):
    _, family, _, user = setup_family(client, app)
    reminder = add(client, family, [user["id"]]).json()["reminder"]
    assert schedule_sms(app.state.sessions, enabled(), NOW)
    with app.state.sessions.begin() as db:
        assert db.get(Wallet, UUID(family)).balance_toman == 9000
        if change == "leave":
            db.execute(delete(Membership).where(Membership.family_id == UUID(family), Membership.user_id == UUID(user["id"])))
        elif change == "inactive":
            db.execute(update(User).where(User.id == UUID(user["id"])).values(active=False))
    if change == "remove_selection":
        assert client.put(f"/api/reminders/{reminder['id']}", json={
            "title": reminder["title"], "due_at": reminder["due_at"], "recipient_user_ids": [],
        }).status_code == 200
    elif change == "delete":
        assert client.delete(f"/api/reminders/{reminder['id']}").status_code == 204
    sender = Sender()
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 2
    cancelled = change in {"remove_selection", "delete"}
    assert [call[0] for call in sender.calls] == ([] if cancelled else [PHONE])
    with app.state.sessions() as db:
        assert db.get(Wallet, UUID(family)).balance_toman == (10000 if cancelled else 9500)
        refunds = db.scalars(select(Entry).where(Entry.kind == "sms_refund")).all()
        assert len(refunds) == (2 if cancelled else 1)


def test_rejection_refunds_only_that_recipient_and_status_is_partial(client, app):
    _, family, _, user = setup_family(client, app)
    reminder = add(client, family, [user["id"]]).json()["reminder"]
    class PartialSender(Sender):
        def send_pattern(self, phone, pattern, attributes):
            if phone == user["phone"]:
                raise SmsRejected("rejected")
            super().send_pattern(phone, pattern, attributes)
    sender = PartialSender()
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 2
    with app.state.sessions() as db:
        assert db.get(Wallet, UUID(family)).balance_toman == 9500
        assert db.get(Reminder, UUID(reminder["id"])).sms_status == "skipped"


def test_old_client_preserves_selection_and_family_switch_requires_valid_members(client, app):
    _, family, _, user = setup_family(client, app)
    reminder = add(client, family, [user["id"]]).json()["reminder"]
    body = {"title": reminder["title"], "due_at": reminder["due_at"]}
    updated = client.put(f"/api/reminders/{reminder['id']}", json=body)
    assert updated.json()["reminder"]["recipient_user_ids"] == [user["id"]]
    assert client.put(f"/api/reminders/{reminder['id']}", json={**body, "sms_family_id": None}).status_code == 422
    assert client.put(f"/api/reminders/{reminder['id']}", json={**body,
        "sms_family_id": None, "recipient_user_ids": []}).status_code == 200


def test_insufficient_funds_never_overdraw_for_multiple_recipients(client, app):
    _, family, _, user = setup_family(client, app)
    add(client, family, [user["id"]])
    with app.state.sessions.begin() as db:
        from app.wallets.service import locked_wallet, record
        record(db, locked_wallet(db, UUID(family)), "sms", uuid4(), -9500)
    sender = Sender()
    assert run_batch(app.state.sessions, enabled(), sender, now=NOW) == 1
    assert [call[0] for call in sender.calls] == [PHONE]
    with app.state.sessions() as db:
        assert db.get(Wallet, UUID(family)).balance_toman == 0


@pytest.mark.usefixtures("before_signup_gifts")
@pytest.mark.parametrize("app", ["d7c8412eab30"], indirect=True)
def test_migration_preserves_queued_owner_delivery(client, app):
    owner = register(client)
    family = create(client)
    # Seed the previous revision without querying the newer reminder model.
    from sqlalchemy import text
    reminder_id, attempt_id = uuid4(), uuid4()
    with app.state.sessions.begin() as db:
        db.execute(text("INSERT INTO reminders.entries "
            "(id,user_id,title,due_at,request_id,request_fingerprint,created_at,sms_family_id) "
            "VALUES (:id,:user,'legacy',:due,:request,'legacy',:due,:family)"),
            {"id": reminder_id, "user": UUID(owner["id"]), "due": NOW, "request": uuid4(), "family": UUID(family)})
        db.execute(text("INSERT INTO reminders.sms_attempts "
            "(id,reminder_id,revision,due_at,attempted_at,status) VALUES (:id,:reminder,0,:due,:due,'accepted')"),
            {"id": attempt_id, "reminder": reminder_id, "due": NOW})
    command.upgrade(Config("alembic.ini"), "head")
    command.check(Config("alembic.ini"))
    with app.state.sessions() as db:
        assert db.get(SmsAttempt, attempt_id).recipient_user_id == UUID(owner["id"])
        assert db.get(Reminder, reminder_id).recipient_user_ids == []
    command.downgrade(Config("alembic.ini"), "d7c8412eab30")
