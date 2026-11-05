from datetime import datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import update
from test_expenses import payload as expense_payload
from test_families import account, create
from test_income import payload as income_payload
from test_users import register

from app.expenses.models import ExpenseEntry
from app.income.models import IncomeEntry


@pytest.mark.parametrize("module,model,payload", [("expenses", ExpenseEntry, expense_payload), ("income", IncomeEntry, income_payload)])
def test_reports_full_totals_dates_paging_and_permissions(client, app, module, model, payload):
    user = register(client)
    family = create(client)
    base = f"/api/families/{family}/{module}"
    ids = []
    for _ in range(23):
        result = client.post(base, json=payload(user, amount_toman=1000000000000))
        assert result.status_code == 201
        ids.append(UUID(result.json()["entry"]["id"]))
    # 21 in the selected Tehran day, one just before, one exactly at the next day.
    with app.state.sessions.begin() as db:
        db.execute(update(model).where(model.id.in_(ids)).values(created_at=datetime.fromisoformat("2026-11-04T20:30:00+00:00")))
        db.execute(update(model).where(model.id == ids[-2]).values(created_at=datetime.fromisoformat("2026-11-04T20:29:59+00:00")))
        db.execute(update(model).where(model.id == ids[-1]).values(created_at=datetime.fromisoformat("2026-11-05T20:30:00+00:00")))
    query = "/report?start=2026-11-05&end=2026-11-05"
    response = client.get(base + query)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["count"] == 21
    assert report["total_toman"] == "21000000000000"
    assert report["previous_total_toman"] == "1000000000000"
    assert report["daily"] == [{"date": "2026-11-05", "total_toman": "21000000000000", "count": 21}]
    assert sum(int(g["total_toman"]) for g in report["groups"]) == 21000000000000
    assert len(report["entries"]) == 20
    page = client.get(base + query + "&offset=20").json()
    assert len(page["entries"]) == 1 and page["total_toman"] == report["total_toman"]
    assert not {r["id"] for r in page["entries"]} & {r["id"] for r in report["entries"]}
    assert client.get(base + query + "&offset=40").json()["entries"] == []
    empty = client.get(base + "/report?start=2025-01-01&end=2025-01-02").json()
    assert empty["total_toman"] == "0" and empty["groups"] == []
    stranger, _ = account(app, "09123456780")
    with stranger:
        assert stranger.get(base + query).status_code == 404
    for q in ["start=2026-11-06&end=2026-11-05", "start=2024-01-01&end=2026-11-05", "start=no&end=2026-11-05", "start=1999-12-31&end=2000-01-01", "start=2026-11-05&end=2026-11-05&offset=-1"]:
        assert client.get(base + "/report?" + q).status_code == 422


def test_reports_require_authentication(client):
    for module in ["income", "expenses"]:
        assert client.get(f"/api/families/{uuid4()}/{module}/report?start=2026-11-05&end=2026-11-05").status_code == 401
