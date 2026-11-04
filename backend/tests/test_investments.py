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
        {"grams": "NaN"}, {"grams": "Infinity"}, {"grams": True}, {"kind": "silver"},
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
