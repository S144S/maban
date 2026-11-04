from uuid import uuid4

from test_families import account
from test_users import register


def payload(**overrides):
    return {"kind": "gold", "grams": "2.125", "request_id": str(uuid4()), **overrides}


def test_personal_investments_and_retries(client, app):
    assert client.get("/api/investments").status_code == 401
    assert client.post("/api/investments", json=payload()).status_code == 401
    register(client)
    data = payload(description="  طلای من  ")
    result = client.post("/api/investments", json=data)
    assert result.status_code == 201, result.text
    entry = result.json()["entry"]
    assert entry["grams"] == "2.125"
    assert entry["unit_price_toman"] is None and entry["total_price_toman"] is None
    assert entry["description"] == "طلای من"
    assert client.post("/api/investments", json=data).json() == result.json()
    assert client.post("/api/investments", json={**data, "grams": "3"}).status_code == 409
    assert client.get("/api/investments").json()["count"] == 1
    other, _ = account(app, "09123456780")
    with other:
        assert other.get("/api/investments").json()["entries"] == []
        assert other.post("/api/investments", json=data).status_code == 201
    assert client.get("/api/investments?offset=1").json()["entries"] == []
    assert client.get("/api/investments?offset=-1").status_code == 422
    assert client.post("/api/investments", json=payload(unit_price_toman=2000000, total_price_toman=4250000)).status_code == 201
    assert client.get("/api/investments").json()["entries"][0]["total_price_toman"] == 4250000


def test_investment_validation(client):
    register(client)
    for overrides in (
        {"grams": "0"}, {"grams": "-1"}, {"grams": "0.0001"}, {"grams": "1000001"},
        {"grams": "NaN"}, {"grams": "Infinity"}, {"grams": True}, {"kind": "unsupported"},
        {"unit_price_toman": 0}, {"unit_price_toman": 1.5}, {"total_price_toman": -1},
        {"total_price_toman": True}, {"total_price_toman": 1000000000001},
        {"description": "x" * 501}, {"user_id": str(uuid4())},
    ):
        result = client.post("/api/investments", json=payload(**overrides))
        assert result.status_code == 422, (overrides, result.text)
    for grams in ("0.001", "1000000"):
        assert client.post("/api/investments", json=payload(grams=grams)).status_code == 201


def test_investment_schema_ownership():
    from app.investments.persistence import TABLES

    assert all(table.schema == "investments" and not table.foreign_keys for table in TABLES)


def test_stock_creation_validation_and_exact_totals(client, app):
    register(client)
    url = "/api/investments"
    data = {"kind": "stock", "symbol": "  فولاد  ", "shares": 100, "request_id": str(uuid4())}
    result = client.post(url, json=data)
    assert result.status_code == 201, result.text
    entry = result.json()["entry"]
    assert entry["symbol"] == "فولاد" and entry["shares"] == 100
    assert entry["grams"] is None and entry["total_price_toman"] is None
    assert entry["calculated_total_toman"] is None
    assert client.post(url, json=data).json() == result.json()
    assert client.post(url, json={**data, "shares": 101}).status_code == 409
    priced = {**data, "request_id": str(uuid4()), "shares": 1000000000, "unit_price_toman": 1000000000000}
    response = client.post(url, json=priced)
    assert response.status_code == 201, response.text
    assert response.json()["entry"]["calculated_total_toman"] == "1000000000000000000000"
    for changes in ({"symbol": "  "}, {"symbol": "x" * 41}, {"shares": 0}, {"shares": -1},
                    {"shares": 1.5}, {"shares": True}, {"shares": "100"}, {"shares": 1000000001},
                    {"total_price_toman": 100}, {"grams": "1"}, {"unit_price_toman": 0}):
        assert client.post(url, json={**data, **changes, "request_id": str(uuid4())}).status_code == 422
    assert client.post(url, json=payload(symbol="فولاد", shares=1)).status_code == 422
    other, _ = account(app, "09123456780")
    with other:
        assert other.get(url).json()["entries"] == []
    entries = client.get(url).json()["entries"]
    assert len(entries) == 2
    assert entries[0]["calculated_total_toman"] == "1000000000000000000000"


def test_additional_investment_types(client, app):
    from decimal import Decimal

    register(client)
    url = "/api/investments"
    cases = [
        ({"kind": "silver", "grams": "2.125"}, "21250"),
        ({"kind": "crypto", "symbol": "BTC", "quantity": "0.000000000000000001"}, "0.00000000000001"),
        ({"kind": "currency", "symbol": "USD", "quantity": "10.25"}, "102500"),
        ({"kind": "bond", "symbol": "اخزا", "quantity": 10}, "100000"),
    ]
    for fields, total in cases:
        data = {**fields, "request_id": str(uuid4()), "unit_price_toman": 10000}
        result = client.post(url, json=data)
        assert result.status_code == 201, result.text
        entry = result.json()["entry"]
        assert Decimal(entry["calculated_total_toman"]) == Decimal(total)
        assert entry["total_price_toman"] is None
        assert client.post(url, json=data).json() == result.json()
        assert client.post(url, json={**data, "unit_price_toman": 1}).status_code == 409
        for extra in ({"total_price_toman": 10}, {"shares": 10}, {"user_id": str(uuid4())}):
            assert client.post(url, json={**data, **extra}).status_code == 422
        no_price = client.post(url, json={**fields, "request_id": str(uuid4())})
        assert no_price.status_code == 201
        assert no_price.json()["entry"]["calculated_total_toman"] is None
    assert client.get(url).json()["count"] == 8
    other, _ = account(app, "09123456780")
    with other:
        assert other.get(url).json()["entries"] == []
    for kind, values in [("crypto", ["0", "NaN", "Infinity", "0.0000000000000000001", "1000000001"]),
                         ("currency", ["1.001", "-1", "1000000001"]),
                         ("bond", [True, "1", 1.5, 0, 1000000001])]:
        for quantity in values:
            data = {"kind": kind, "symbol": "test", "quantity": quantity, "request_id": str(uuid4())}
            assert client.post(url, json=data).status_code == 422
        for symbol in ("  ", "x" * 41):
            assert client.post(url, json={"kind": kind, "symbol": symbol, "quantity": 1,
                                         "request_id": str(uuid4())}).status_code == 422
    precise = {"kind": "crypto", "symbol": "BTC", "quantity": "999999999.123456789123456789",
               "unit_price_toman": 999999999999, "request_id": str(uuid4())}
    assert client.post(url, json=precise).json()["entry"]["calculated_total_toman"] == "999999999122456789124.333332210876543211"
