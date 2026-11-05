from uuid import uuid4

from test_families import account
from test_users import register


def property_data(**changes):
    return {"kind": "house", "title": "  خانه  ", "location": "تهران", "area_sqm": "85.25",
            "request_id": str(uuid4()), **changes}


def car_data(**changes):
    return {"kind": "car", "brand": "پژو", "model": "۲۰۶", "manufacture_year": 1400,
            "year_calendar": "solar", "request_id": str(uuid4()), **changes}


def test_asset_ownership_creation_and_retries(client, app):
    url = "/api/assets"
    assert client.get(url).status_code == 401
    assert client.post(url, json=property_data()).status_code == 401
    register(client)
    for data in (property_data(), property_data(kind="land", purchase_price_toman=1000000000000),
                 car_data(), car_data(manufacture_year=2024, year_calendar="gregorian")):
        result = client.post(url, json=data)
        assert result.status_code == 201, result.text
        assert client.post(url, json=data).json() == result.json()
        assert client.post(url, json={**data, "description": "changed"}).status_code == 409
        entry = result.json()["entry"]
        if data["kind"] != "car":
            assert entry["area_sqm"] == "85.25" and entry["title"] == "خانه"
        else:
            assert entry["area_sqm"] is None
            assert entry["manufacture_year"] == data["manufacture_year"]
    assert client.get(url).json()["count"] == 4
    assert client.get(url + "?offset=4").json()["entries"] == []
    assert client.get(url + "?offset=-1").status_code == 422
    other, _ = account(app, "09123456780")
    with other:
        assert other.get(url).json()["entries"] == []
        assert other.post(url, json=car_data()).status_code == 201
    assert client.get(url).json()["count"] == 4


def test_asset_validation(client):
    register(client)
    for changes in ({"title": "  "}, {"location": " "}, {"area_sqm": "0"}, {"area_sqm": "1.001"},
                    {"area_sqm": "NaN"}, {"area_sqm": True}, {"area_sqm": "1000000001"},
                    {"brand": "x"}, {"purchase_price_toman": 0}, {"purchase_price_toman": 1.2},
                    {"purchase_price_toman": True}, {"purchase_price_toman": 1000000000001},
                    {"description": "x" * 501}, {"user_id": str(uuid4())}):
        assert client.post("/api/assets", json=property_data(**changes)).status_code == 422
    for changes in ({"brand": " "}, {"model": " "}, {"manufacture_year": True},
                    {"manufacture_year": 1400.5}, {"manufacture_year": 2024},
                    {"year_calendar": "gregorian"}, {"year_calendar": "other"}, {"area_sqm": "2"}):
        assert client.post("/api/assets", json=car_data(**changes)).status_code == 422
    assert client.post("/api/assets", json=property_data(area_sqm="0.01")).status_code == 201
    assert client.post("/api/assets", json=property_data(area_sqm="1000000000")).status_code == 201


def test_asset_schema_ownership():
    from app.assets.persistence import TABLES

    assert all(table.schema == "assets" and not table.foreign_keys for table in TABLES)


def test_property_unit_price_is_separate_from_purchase_total(client):
    register(client)
    for kind in ("house", "land"):
        data = property_data(kind=kind, price_per_sqm_toman=100000000)
        response = client.post("/api/assets", json=data)
        assert response.status_code == 201
        assert response.json()["entry"]["price_per_sqm_toman"] == 100000000
        assert response.json()["entry"]["purchase_price_toman"] is None
        assert client.post("/api/assets", json=data).json() == response.json()
    legacy = client.post("/api/assets", json=property_data(purchase_price_toman=1000)).json()["entry"]
    assert legacy["purchase_price_toman"] == 1000 and legacy["price_per_sqm_toman"] is None
    assert client.post("/api/assets", json=car_data(price_per_sqm_toman=1000)).status_code == 422
    for price in (0, -1, True, 1.5, 1000000000001):
        assert client.post("/api/assets", json=property_data(price_per_sqm_toman=price)).status_code == 422


def test_car_combined_model_without_brand(client):
    register(client)
    data = car_data(model="پژو 206 SD")
    del data["brand"]
    result = client.post("/api/assets", json=data)
    assert result.status_code == 201, result.text
    assert result.json()["entry"]["brand"] is None
    assert result.json()["entry"]["model"] == "پژو 206 SD"
    assert client.post("/api/assets", json=data).json() == result.json()
