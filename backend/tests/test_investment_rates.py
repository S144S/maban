from decimal import Decimal
from uuid import uuid4

from test_families import account
from test_users import register


def add(client, **fields):
    response = client.post("/api/investments", json={"request_id": str(uuid4()), **fields})
    assert response.status_code == 201, response.text
    return response.json()["entry"]


def test_rates_ownership_validation_and_purchase_preservation(client, app):
    url = "/api/investments/rates"
    assert client.get(url).status_code == 401
    assert client.put(url, json={"kind": "gold", "unit_price_toman": 100}).status_code == 401
    register(client)
    assert client.get(url).json()["entries"] == []
    assert client.put(url, json={"kind": "gold", "unit_price_toman": 100}).status_code == 409
    add(client, kind="gold", grams="2.125", total_price_toman=100)
    purchase = client.get("/api/investments/summary").json()
    assert client.get("/api/investments/current-summary").json()["unpriced_count"] == 1
    result = client.put(url, json={"kind": "gold", "unit_price_toman": 200}).json()
    assert Decimal(result["summary"]["total_toman"]) == Decimal(425)
    assert result["entries"][0]["updated_at"]
    other, _ = account(app, "09123456780")
    with other:
        assert other.get(url).json()["entries"] == []
        assert other.put(url, json={"kind": "gold", "unit_price_toman": None}).status_code == 409
        add(other, kind="gold", grams="1")
        other.put(url, json={"kind": "gold", "unit_price_toman": 1})
        assert Decimal(other.get("/api/investments/current-summary").json()["total_toman"]) == 1
    assert Decimal(client.get("/api/investments/current-summary").json()["total_toman"]) == 425
    for fields in ({"unit_price_toman": 0}, {"unit_price_toman": -1}, {"unit_price_toman": True},
                   {"unit_price_toman": 1.5}, {"unit_price_toman": 1000000000001},
                   {"symbol": "18k"}, {"kind": "stock"}, {"kind": "unknown"},
                   {"user_id": str(uuid4())}):
        assert client.put(url, json={"kind": "gold", "unit_price_toman": 100, **fields}).status_code == 422
    assert client.put(url, json={"kind": "gold", "unit_price_toman": 400}).status_code == 200
    assert Decimal(client.get("/api/investments/current-summary").json()["total_toman"]) == 850
    assert client.get("/api/investments/summary").json() == purchase
    assert client.get("/api/investments").json()["entries"][0]["total_price_toman"] == 100
    cleared = client.put(url, json={"kind": "gold", "unit_price_toman": None}).json()
    assert cleared["summary"]["unpriced_count"] == 1
    assert cleared["entries"][0]["unit_price_toman"] is None
    assert cleared["entries"][0]["value_toman"] is None
    assert client.put(url, json={"kind": "gold", "unit_price_toman": None}).json() == cleared


def test_all_kinds_exact_aggregation_and_symbol_boundaries(client):
    register(client)
    cases = [("gold", "", {"grams": "2.125"}, "21250"),
             ("silver", "", {"grams": "2.125"}, "21250"),
             ("stock", "فولاد", {"shares": 10}, "100000"),
             ("crypto", "BTC", {"quantity": "0.000000000000000001"}, "0.00000000000001"),
             ("currency", "USD", {"quantity": "10.25"}, "102500"),
             ("bond", "اخزا", {"quantity": 10}, "100000")]
    for kind, symbol, fields, value in cases:
        add(client, kind=kind, **({"symbol": symbol} if symbol else {}), **fields)
        response = client.put("/api/investments/rates", json={"kind": kind, "symbol": symbol, "unit_price_toman": 10000})
        assert response.status_code == 200, response.text
        row = next(r for r in response.json()["entries"] if r["kind"] == kind)
        assert Decimal(row["value_toman"]) == Decimal(value)
    # A different spelling is a different instrument; never guess aliases.
    add(client, kind="crypto", symbol="بیت‌کوین", quantity="1")
    assert client.get("/api/investments/current-summary").json()["unpriced_count"] == 1
    # More than one page of investments still contributes to the rate and summary.
    for _ in range(51):
        add(client, kind="stock", symbol="فولاد", shares=1000000000)
    response = client.get("/api/investments/rates").json()
    stock = next(r for r in response["entries"] if r["kind"] == "stock")
    assert stock["count"] == 52
    assert Decimal(stock["quantity"]) == Decimal(51000000010)
    assert response["summary"]["count"] == 58
    assert Decimal(response["summary"]["total_toman"]) == Decimal("510000000345000.00000000000001")
