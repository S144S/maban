from decimal import Decimal
from uuid import uuid4

from test_assets import car_data, property_data
from test_families import account
from test_investments import payload
from test_users import register


def test_investment_summary_exact_complete_and_private(client, app):
    url = "/api/investments/summary"
    assert client.get(url).status_code == 401
    register(client)
    assert client.get(url).json() == {"total_toman": "0", "count": 0, "unpriced_count": 0,
                                     "valuation_basis": "recorded_purchase_prices"}
    entries = [
        payload(grams="2", unit_price_toman=10, total_price_toman=25),
        payload(grams="1.25", unit_price_toman=10),
        payload(grams="2"),
        {"kind": "stock", "symbol": "x", "shares": 3, "unit_price_toman": 10},
        {"kind": "silver", "grams": "2.5", "unit_price_toman": 10},
        {"kind": "crypto", "symbol": "x", "quantity": "0.000000000000000001", "unit_price_toman": 1},
        {"kind": "currency", "symbol": "USD", "quantity": "1.25", "unit_price_toman": 10},
        {"kind": "bond", "symbol": "x", "quantity": 2, "unit_price_toman": 10},
    ]
    for data in entries:
        response = client.post("/api/investments", json={**data, "request_id": str(uuid4())})
        assert response.status_code == 201, response.text
    for _ in range(45):
        assert client.post("/api/investments", json=payload(grams="1", total_price_toman=1)).status_code == 201
    result = client.get(url).json()
    assert result["count"] == 53 and result["unpriced_count"] == 1
    assert Decimal(result["total_toman"]) == Decimal("170.000000000000000001")
    other, _ = account(app, "09123456780")
    with other:
        assert other.get(url).json()["count"] == 0


def test_asset_summary_unit_prices_legacy_totals_and_missing_prices(client, app):
    url = "/api/assets/summary"
    assert client.get(url).status_code == 401
    register(client)
    assert client.get(url).json()["total_toman"] == "0"
    entries = [property_data(area_sqm="2.5", price_per_sqm_toman=10, purchase_price_toman=999),
               property_data(kind="land", purchase_price_toman=100), car_data(purchase_price_toman=20),
               property_data(), car_data()]
    for data in entries:
        assert client.post("/api/assets", json=data).status_code == 201
    result = client.get(url).json()
    assert Decimal(result["total_toman"]) == 145
    assert result["count"] == 5 and result["unpriced_count"] == 2
    other, _ = account(app, "09123456780")
    with other:
        assert other.get(url).json()["count"] == 0
