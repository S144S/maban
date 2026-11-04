from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.expenses.dependencies import Service
from app.expenses.schemas import CreateExpense
from app.users.public import CurrentUser

router = APIRouter(prefix="/api/families/{family_id}/expenses", tags=["expenses"])


@router.get("")
def list_expenses(
    family_id: UUID,
    current: CurrentUser,
    service: Service,
    offset: Annotated[int, Query(ge=0, le=1000000)] = 0,
):
    return service.list(family_id, current.id, offset)


@router.post("", status_code=201)
def create_expense(family_id: UUID, data: CreateExpense, current: CurrentUser, service: Service):
    return {"entry": service.create(family_id, current.id, data)}
