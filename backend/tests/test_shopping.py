from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from conftest import HEADERS
from fastapi.testclient import TestClient
from test_families import accept, account, create, invite
from test_users import register


def payload(**changes):
    return {"name": "شیر", "quantity": "۲ بسته", "note": "کم‌چرب",
            "request_id": str(uuid4()), **changes}


def make_checkout_list(client, count=3):
    family = create(client)
    base = f"/api/families/{family}/shopping"
    result = client.post(base + "/lists", json={"name": "خرید هفتگی", "request_id": str(uuid4()),
        "items": [{"name": f"کالا {i}"} for i in range(count)]})
    assert result.status_code == 201, result.text
    list_id = result.json()["list"]["id"]
    view = base + f"?list_id={list_id}"
    return family, base, view, f"{base}/lists/{list_id}/complete", list_id


def test_complete_whole_list_one_expense_all_pages_and_durable_retry(client):
    register(client)
    family, base, view, checkout, list_id = make_checkout_list(client, 55)
    initial = client.get(view).json()
    assert len(initial["items"]) == 50 and initial["has_more"]
    category = client.post(f"/api/families/{family}/expenses/categories", json={
        "name": "خرید خونه", "request_id": str(uuid4())}).json()["category"]
    data = {"token": initial["checkout"]["token"], "request_id": str(uuid4()),
            "amount_toman": 1500000, "category_id": category["id"]}
    result = client.post(checkout, json=data)
    assert result.status_code == 200, result.text
    assert result.json()["completed_count"] == 55
    assert client.post(checkout, json=data).json() == result.json()
    assert client.post(checkout, json={**data, "amount_toman": 2000000}).status_code == 409
    after = client.get(view).json()
    assert after["pending_count"] == 0 and after["purchased_count"] == 55 and after["checkout"]["has_expense"]
    bought = client.get(view + "&status=purchased").json()["items"]
    bought += client.get(view + "&status=purchased&offset=50").json()["items"]
    assert all(item["expense_id"] == result.json()["expense_id"] and item["version"] == 2 for item in bought)
    expenses = client.get(f"/api/families/{family}/expenses").json()
    assert expenses["count"] == 1 and expenses["total_toman"] == "1500000"
    assert expenses["entries"][0]["title"] == "خرید هفتگی"
    assert expenses["entries"][0]["category_id"] == category["id"]
    item = bought[0]
    client.put(base + f"/{item['id']}/status", json={"purchased": False, "version": item["version"]})
    # Retrying the old operation must not re-complete an item undone afterwards.
    assert client.post(checkout, json=data).json() == result.json()
    assert client.get(view).json()["pending_count"] == 1
    fresh = client.get(view).json()["checkout"]["token"]
    assert client.post(checkout, json={**data, "token": fresh, "request_id": str(uuid4())}).status_code == 409
    assert client.post(checkout, json={"token": fresh, "request_id": str(uuid4())}).status_code == 200
    assert client.get(f"/api/families/{family}/expenses").json()["count"] == 1
    assert client.get(view).json()["pending_count"] == 0
    # Even deleting all linked items cannot allow a second list charge.
    remaining = client.get(view + "&status=purchased").json()["items"]
    remaining += client.get(view + "&status=purchased&offset=50").json()["items"]
    for item in remaining:
        client.delete(base + f"/{item['id']}?version={item['version']}")
    new = client.post(base, json=payload(list_id=list_id)).json()["item"]
    fresh = client.get(view).json()["checkout"]
    assert fresh["has_expense"] and new["expense_id"] is None
    assert client.post(checkout, json={**data, "token": fresh["token"], "request_id": str(uuid4())}).status_code == 409


def test_complete_list_stale_changes_validation_and_existing_item_expense(client, app):
    register(client)
    family, base, view, checkout, list_id = make_checkout_list(client)
    state = client.get(view).json()
    data = {"token": state["checkout"]["token"], "request_id": str(uuid4()), "amount_toman": 1000}
    client.post(base, json=payload(list_id=list_id))
    assert client.post(checkout, json=data).status_code == 409
    state = client.get(view).json()
    item = state["items"][0]
    client.put(base + f"/{item['id']}/status", json={"purchased": True, "version": 1, "amount_toman": 500})
    state = client.get(view).json()
    data["token"] = state["checkout"]["token"]
    assert client.post(checkout, json=data).status_code == 409
    assert client.get(view).json()["pending_count"] == 3
    for changes in ({"amount_toman": 0}, {"amount_toman": True}, {"amount_toman": 1.5},
                    {"amount_toman": 1000000000001}, {"token": "bad"},
                    {"amount_toman": None, "category_id": str(uuid4())}):
        assert client.post(checkout, json={**data, **changes}).status_code == 422
    with account(app, "09123456780")[0] as other:
        assert other.post(checkout, json=data).status_code == 404
        own = create(other)
        assert other.post(f"/api/families/{own}/shopping/lists/{list_id}/complete", json=data).status_code == 404
    assert client.post(checkout, json={"token": data["token"], "request_id": str(uuid4())}).status_code == 200
    assert client.get(view).json()["pending_count"] == 0
    assert client.get(f"/api/families/{family}/expenses").json()["total_toman"] == "500"


def test_complete_list_atomic_failure_empty_and_concurrent_requests(client, app, monkeypatch):
    from app.expenses.public import PurchaseExpenses

    register(client)
    family, base, view, checkout, _list_id = make_checkout_list(client)
    data = {"token": client.get(view).json()["checkout"]["token"], "request_id": str(uuid4()), "amount_toman": 5000}
    record = PurchaseExpenses.record

    def fail(self, **values):
        record(self, **values)
        raise RuntimeError("checkout failure")

    monkeypatch.setattr(PurchaseExpenses, "record", fail)
    with pytest.raises(RuntimeError, match="checkout failure"):
        client.post(checkout, json=data)
    assert client.get(view).json()["pending_count"] == 3
    assert client.get(f"/api/families/{family}/expenses").json()["count"] == 0
    monkeypatch.setattr(PurchaseExpenses, "record", record)
    cookies = dict(client.cookies)

    def complete(_):
        with TestClient(app, headers=HEADERS, cookies=cookies) as concurrent:
            return concurrent.post(checkout, json=data)

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(complete, range(4)))
    assert all(result.status_code == 200 and result.json() == results[0].json() for result in results)
    assert client.get(f"/api/families/{family}/expenses").json()["count"] == 1
    assert client.get(view).json()["pending_count"] == 0
    empty_id = client.post(base + "/lists", json={"name": "خالی", "request_id": str(uuid4())}).json()["list"]["id"]
    token = client.get(base + f"?list_id={empty_id}").json()["checkout"]["token"]
    assert client.post(base + f"/lists/{empty_id}/complete", json={"token": token, "request_id": str(uuid4())}).status_code == 409


@pytest.mark.parametrize("individual", [False, True])
def test_complete_list_serializes_competing_payments(client, app, individual):
    register(client)
    family, base, view, checkout, _list_id = make_checkout_list(client)
    state = client.get(view).json()
    data = {"token": state["checkout"]["token"], "request_id": str(uuid4()), "amount_toman": 2000}
    cookies = dict(client.cookies)

    def pay(index):
        with TestClient(app, headers=HEADERS, cookies=cookies) as concurrent:
            if index and individual:
                return concurrent.put(base + f"/{state['items'][0]['id']}/status", json={
                    "purchased": True, "version": 1, "amount_toman": 1000}).status_code
            body = data if not index else {**data, "request_id": str(uuid4()), "amount_toman": 1000}
            return concurrent.post(checkout, json=body).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(pay, range(2))) == [200, 409]
    assert client.get(f"/api/families/{family}/expenses").json()["count"] == 1


def test_named_lists_batch_creation_isolation_and_retry(client, app):
    register(client)
    base = f"/api/families/{create(client)}/shopping"
    data = {"name": "خرید هفتگی", "request_id": str(uuid4()), "items": [
        {"name": "قهوه", "quantity": "۲ بسته"}, {"name": "نان"}]}
    cookies = dict(client.cookies)

    def add(_):
        with TestClient(app, headers=HEADERS, cookies=cookies) as concurrent:
            response = concurrent.post(base + "/lists", json=data)
            assert response.status_code == 201, response.text
            return response.json()["list"]

    with ThreadPoolExecutor(max_workers=4) as pool:
        lists = list(pool.map(add, range(4)))
    assert all(row == lists[0] for row in lists)
    first = lists[0]
    assert client.post(base + "/lists", json={**data, "name": "تغییر"}).status_code == 409
    assert client.post(base + "/lists", json={**data, "items": [{"name": " "}]}).status_code == 422
    assert client.post(base + "/lists", json={**data, "items": [{"name": "نان"}] * 101}).status_code == 422
    listing = client.get(base + "/lists").json()
    assert listing == {"lists": [{**first, "pending_count": 2, "purchased_count": 0}], "has_more": False}
    second = client.post(base + "/lists", json={"name": "مهمونی", "request_id": str(uuid4())}).json()["list"]
    item = client.post(base, json=payload(list_id=second["id"])).json()["item"]
    assert client.get(base + f"?list_id={second['id']}").json()["items"] == [item]
    assert client.get(base + f"?list_id={first['id']}").json()["pending_count"] == 2
    assert client.get(base + f"?list_id={uuid4()}").status_code == 404
    with account(app, "09123456780")[0] as other:
        other_base = f"/api/families/{create(other)}/shopping"
        assert other.post(other_base, json=payload(list_id=first["id"])).status_code == 404
        assert other.get(other_base + f"?list_id={first['id']}").status_code == 404
        assert other.get(base + "/lists").status_code == 404
    client.put(base + f"/{item['id']}/status", json={"purchased": True, "version": 1, "amount_toman": 1000})
    counts = {row["id"]: row for row in client.get(base + "/lists").json()["lists"]}
    assert counts[second["id"]]["purchased_count"] == 1
    assert counts[second["id"]]["pending_count"] == 0
    assert counts[first["id"]]["pending_count"] == 2


@pytest.mark.parametrize("app", ["f09ab23d715c"], indirect=True)
def test_named_list_migration_preserves_items_and_receipts(client, app):
    from sqlalchemy import text

    user = register(client)
    family = create(client)
    item_id, receipt = uuid4(), uuid4()
    with app.state.engine.begin() as db:
        db.execute(text("INSERT INTO shopping.items (id,family_id,name,quantity,note,created_by,created_at,"
            "purchased_at,purchased_by,version,request_id,request_fingerprint,expense_id) "
            "VALUES (:id,:family,'قهوه','۲ بسته','',:actor,now(),now(),:actor,2,:request,'legacy-test',:expense)"),
            {"id": item_id, "family": family, "actor": user["id"], "request": uuid4(), "expense": receipt})
    command.upgrade(Config("alembic.ini"), "head")
    base = f"/api/families/{family}/shopping"
    lists = client.get(base + "/lists").json()["lists"]
    assert len(lists) == 1 and lists[0]["purchased_count"] == 1
    item = client.get(base + f"?status=purchased&list_id={lists[0]['id']}").json()["items"][0]
    assert item["id"] == str(item_id) and item["expense_id"] == str(receipt) and item["version"] == 2
    assert item["name"] == "قهوه" and item["quantity"] == "۲ بسته"
    with pytest.raises(RuntimeError, match="Refusing"):
        command.downgrade(Config("alembic.ini"), "f09ab23d715c")


def test_named_list_batch_rolls_back_on_item_failure(client, monkeypatch):
    from app.shopping.service import Shopping, ShoppingError

    register(client)
    base = f"/api/families/{create(client)}/shopping"
    original = Shopping.create

    def fail_second(self, family_id, user_id, data):
        if data.name == "خطا":
            raise ShoppingError("ثبت کالا ناموفق بود.")
        return original(self, family_id, user_id, data)

    monkeypatch.setattr(Shopping, "create", fail_second)
    data = {"name": "خرید هفتگی", "request_id": str(uuid4()), "items": [{"name": "نان"}, {"name": "خطا"}]}
    assert client.post(base + "/lists", json=data).status_code == 409
    assert client.get(base + "/lists").json()["lists"] == []
    assert client.get(base).json()["pending_count"] == 0
    monkeypatch.setattr(Shopping, "create", original)
    assert client.post(base + "/lists", json=data).status_code == 201
    assert client.get(base).json()["pending_count"] == 2


def test_full_flow_durable_creation_and_conflicts(client):
    assert client.get(f"/api/families/{uuid4()}/shopping").status_code == 401
    register(client)
    base = f"/api/families/{create(client)}/shopping"
    data = payload()
    created = client.post(base, json=data)
    assert created.status_code == 201, created.text
    item = created.json()["item"]
    assert item["version"] == 1 and not item["purchased"] and item["purchased_at"] is None
    assert client.post(base, json=data).json() == created.json()
    assert client.post(base, json={**data, "quantity": "۳ بسته"}).status_code == 409
    url = f"{base}/{item['id']}"
    result = client.get(base).json()
    assert result == {"items": [item], "pending_count": 1, "purchased_count": 0, "has_more": False}
    fields = {"name": "شیر تازه", "quantity": "۳ بسته", "note": "", "version": 1}
    updated = client.put(url, json=fields).json()["item"]
    assert updated["name"] == "شیر تازه" and updated["version"] == 2
    assert client.put(url, json=fields).status_code == 409
    assert client.put(url + "/status", json={"purchased": True, "version": 1}).status_code == 409
    purchased = client.put(url + "/status", json={"purchased": True, "version": 2}).json()["item"]
    assert purchased["purchased"] and purchased["purchased_at"] and purchased["version"] == 3
    assert client.get(base).json()["pending_count"] == 0
    assert client.get(base + "?status=purchased").json()["items"] == [purchased]
    # An unchanged status does not manufacture another purchase date or version.
    assert client.put(url + "/status", json={"purchased": True, "version": 3}).json()["item"] == purchased
    undone = client.put(url + "/status", json={"purchased": False, "version": 3}).json()["item"]
    assert undone["version"] == 4 and undone["purchased_at"] is None
    # A late create retry neither duplicates nor overwrites later edits/status changes.
    assert client.post(base, json=data).json()["item"] == undone
    assert client.delete(url + "?version=3").status_code == 409
    assert client.delete(url + "?version=4").status_code == 204
    assert client.delete(url + "?version=4").status_code == 204
    assert client.get(base).json()["items"] == []
    assert client.post(base, json=data).status_code == 409
    assert client.put(url, json={**fields, "version": 5}).status_code == 404


def test_family_isolation_and_shared_member_changes(client, app):
    register(client)
    family = create(client)
    base = f"/api/families/{family}/shopping"
    data = payload()
    item = client.post(base, json=data).json()["item"]
    url = f"{base}/{item['id']}"
    with account(app, "09123456780")[0] as other:
        own = create(other)
        for path in (base, base + "?status=purchased"):
            assert other.get(path).status_code == 404
        assert other.post(base, json=payload()).status_code == 404
        assert other.put(url, json={"name": "نان", "version": 1}).status_code == 404
        assert other.put(url + "/status", json={"purchased": True, "version": 1}).status_code == 404
        assert other.delete(url + "?version=1").status_code == 404
        assert other.delete(f"/api/families/{own}/shopping/{item['id']}?version=1").status_code == 404
        assert accept(other, invite(client, family)["token"]).status_code == 200
        assert other.get(base).json()["items"] == [item]
        assert other.post(base, json=data).status_code == 409  # Request belongs to its creator.
        assert other.post(base, json=payload(name="نان")).status_code == 201
        assert other.put(url + "/status", json={"purchased": True, "version": 1}).status_code == 200
        assert client.get(base + "?status=purchased").json()["items"][0]["id"] == item["id"]


def test_validation_pagination_and_migration(client):
    register(client)
    base = f"/api/families/{create(client)}/shopping"
    for changes in ({"name": " "}, {"name": "x" * 121}, {"quantity": "x" * 81},
                    {"note": "x" * 501}, {"purchased": True}, {"created_by": str(uuid4())}):
        assert client.post(base, json=payload(**changes)).status_code == 422
    for i in range(51):
        response = client.post(base, json=payload(name=f"کالا {i}"))
        assert response.status_code == 201, response.text
    first = client.get(base).json()
    second = client.get(base + "?offset=50").json()
    assert len(first["items"]) == 50 and first["has_more"]
    assert len(second["items"]) == 1 and not second["has_more"]
    assert first["pending_count"] == second["pending_count"] == 51
    assert not ({i["id"] for i in first["items"]} & {i["id"] for i in second["items"]})
    assert client.get(base + "?offset=-1").status_code == 422
    assert client.get(base + "?status=invalid").status_code == 422
    url = f"{base}/{first['items'][0]['id']}"
    for status in ({"purchased": "true", "version": 1}, {"purchased": True, "version": True},
                   {"purchased": True, "version": 0}, {"purchased": True, "version": 1, "actor_id": str(uuid4())}):
        assert client.put(url + "/status", json=status).status_code == 422
    assert client.delete(url).status_code == 422
    command.check(Config("alembic.ini"))
    with pytest.raises(RuntimeError, match="Refusing"):
        command.downgrade(Config("alembic.ini"), "d2ea71b93508")


def test_concurrent_creates_and_versioned_edits(client, app):
    register(client)
    base = f"/api/families/{create(client)}/shopping"
    data, cookies = payload(), dict(client.cookies)

    def add(_):
        with TestClient(app, headers=HEADERS, cookies=cookies) as concurrent:
            response = concurrent.post(base, json=data)
            assert response.status_code == 201, response.text
            return response.json()

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(add, range(4)))
    assert all(result == results[0] for result in results)
    assert client.get(base).json()["pending_count"] == 1
    url = f"{base}/{results[0]['item']['id']}"

    def change(i):
        with TestClient(app, headers=HEADERS, cookies=cookies) as concurrent:
            return concurrent.put(url, json={"name": f"تغییر {i}", "version": 1}).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(change, range(2))) == [200, 409]


@pytest.mark.parametrize("app", ["d2ea71b93508"], indirect=True)
def test_empty_schema_upgrade_and_safe_downgrade(client):
    register(client)
    family = create(client)
    command.upgrade(Config("alembic.ini"), "head")
    command.check(Config("alembic.ini"))
    assert client.get(f"/api/families/{family}/shopping").json()["pending_count"] == 0
    command.downgrade(Config("alembic.ini"), "d2ea71b93508")
    command.upgrade(Config("alembic.ini"), "head")
    assert client.get(f"/api/families/{family}").status_code == 200


def test_purchase_creates_one_expense_and_preserves_it_on_undo(client):
    user = register(client)
    family = create(client)
    shopping = f"/api/families/{family}/shopping"
    expenses = f"/api/families/{family}/expenses"
    category = client.post(expenses + "/categories", json={
        "name": "خوراکی", "request_id": str(uuid4())}).json()["category"]
    item = client.post(shopping, json=payload(name="نان")).json()["item"]
    status = f"{shopping}/{item['id']}/status"
    cost = {"purchased": True, "version": 1, "amount_toman": 150000, "category_id": category["id"]}
    purchased = client.put(status, json=cost).json()["item"]
    entries = client.get(expenses).json()
    assert entries["count"] == 1 and entries["total_toman"] == "150000"
    entry = entries["entries"][0]
    assert entry["id"] == purchased["expense_id"]
    assert entry["category_id"] == category["id"] and entry["category_name"] == "خوراکی"
    assert entry["paid_by_member_id"] == user["id"] and entry["title"] == "نان"
    assert client.put(status, json=cost).status_code == 409
    undone = client.put(status, json={"purchased": False, "version": 2}).json()["item"]
    assert undone["expense_id"] == entry["id"] and not undone["purchased"]
    assert client.put(status, json={**cost, "version": 3}).status_code == 409
    again = client.put(status, json={"purchased": True, "version": 3}).json()["item"]
    assert again["expense_id"] == entry["id"]
    assert client.delete(f"{shopping}/{item['id']}?version=4").status_code == 204
    assert client.get(expenses).json()["count"] == 1
    with pytest.raises(RuntimeError, match="Refusing"):
        command.downgrade(Config("alembic.ini"), "aa7c3e21bd90")


def test_optional_cost_validation_default_category_and_atomic_failure(client, monkeypatch):
    from app.expenses.public import PurchaseExpenses

    register(client)
    family = create(client)
    shopping = f"/api/families/{family}/shopping"
    expenses = f"/api/families/{family}/expenses"
    item = client.post(shopping, json=payload()).json()["item"]
    status = f"{shopping}/{item['id']}/status"
    for change in ({"amount_toman": 0}, {"amount_toman": -1}, {"amount_toman": True},
                   {"amount_toman": "1500"}, {"amount_toman": 1.5}, {"amount_toman": 1000000000001},
                   {"category_id": str(uuid4())}, {"purchased": False, "amount_toman": 100}):
        assert client.put(status, json={"purchased": True, "version": 1, **change}).status_code == 422
    assert client.put(status, json={"purchased": True, "version": 1,
        "amount_toman": 100, "category_id": str(uuid4())}).status_code == 404
    assert not client.get(shopping).json()["items"][0]["purchased"]
    assert client.get(expenses).json()["count"] == 0
    original = PurchaseExpenses.record

    def fail_after_expense(self, **kwargs):
        original(self, **kwargs)
        raise RuntimeError("simulated rollback")

    with monkeypatch.context() as patch:
        patch.setattr(PurchaseExpenses, "record", fail_after_expense)
        with pytest.raises(RuntimeError, match="simulated rollback"):
            client.put(status, json={"purchased": True, "version": 1, "amount_toman": 100})
    assert client.get(expenses).json()["count"] == 0
    assert client.get(shopping).json()["items"][0]["version"] == 1
    result = client.put(status, json={"purchased": True, "version": 1, "amount_toman": 100})
    assert result.status_code == 200, result.text
    assert client.get(expenses).json()["entries"][0]["category_name"] == "سایر"
    free = client.post(shopping, json=payload()).json()["item"]
    assert client.put(f"{shopping}/{free['id']}/status", json={"purchased": True, "version": 1}).status_code == 200
    assert client.get(expenses).json()["count"] == 1


def test_concurrent_purchase_with_cost_never_duplicates_expenses(client, app):
    register(client)
    family = create(client)
    shopping = f"/api/families/{family}/shopping"
    item = client.post(shopping, json=payload()).json()["item"]
    cookies = dict(client.cookies)

    def buy(_):
        with TestClient(app, headers=HEADERS, cookies=cookies) as concurrent:
            return concurrent.put(f"{shopping}/{item['id']}/status", json={
                "purchased": True, "version": 1, "amount_toman": 1000}).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(buy, range(2))) == [200, 409]
    assert client.get(f"/api/families/{family}/expenses").json()["total_toman"] == "1000"
