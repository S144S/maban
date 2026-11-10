from decimal import Decimal
from uuid import uuid4

from test_assets import car_data, property_data
from test_families import account
from test_users import register


def test_asset_rates_are_private_exact_and_preserve_purchase_prices(client, app):
    assert client.get("/api/assets/rates").status_code == 401
    assert client.put(f"/api/assets/rates/{uuid4()}", json={"unit_price_toman": 100}).status_code == 401
    register(client)
    assert client.get("/api/assets/rates").json() == {"entries": []}
    ids = []
    inputs = [property_data(purchase_price_toman=500),
              property_data(kind="land", area_sqm="1000000000", price_per_sqm_toman=100),
              car_data(purchase_price_toman=300)]
    for data in inputs:
        result = client.post("/api/assets", json=data)
        assert result.status_code == 201
        ids.append(result.json()["entry"]["id"])
    historical = client.get("/api/assets/summary").json()
    assert client.get("/api/assets/current-summary").json()["unpriced_count"] == 3
    for asset_id, price in zip(ids, [200, 1000000000000, 1000], strict=True):
        assert client.put(f"/api/assets/rates/{asset_id}", json={"unit_price_toman": price}).status_code == 200
    summary = client.get("/api/assets/current-summary").json()
    assert Decimal(summary["total_toman"]) == Decimal(1000000000000000018050)
    assert summary["unpriced_count"] == 0
    assert client.get("/api/assets/summary").json() == historical
    for data, asset_id in zip(inputs, ids, strict=True):
        assert client.post("/api/assets", json=data).json()["entry"]["id"] == asset_id
    for value in [0, -1, True, 1.5, 1000000000001]:
        assert client.put(f"/api/assets/rates/{ids[0]}", json={"unit_price_toman": value}).status_code == 422
    other, _ = account(app, "09123456780")
    with other:
        assert other.get("/api/assets/rates").json()["entries"] == []
        assert other.put(f"/api/assets/rates/{ids[0]}", json={"unit_price_toman": None}).status_code == 409
    assert client.put(f"/api/assets/rates/{ids[0]}", json={"unit_price_toman": None}).status_code == 200
    assert client.get("/api/assets/current-summary").json()["unpriced_count"] == 1
    assert client.get("/api/assets/summary").json() == historical
