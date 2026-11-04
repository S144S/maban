from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.expenses.dependencies import Service
from app.expenses.schemas import CreateCategory, CreateExpense, UpdateCategory
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


@router.get("/categories")
def list_categories(family_id: UUID, current: CurrentUser, service: Service):
    return service.categories(family_id, current.id)


@router.post("/categories", status_code=201)
def create_category(family_id: UUID, data: CreateCategory, current: CurrentUser, service: Service):
    return {"category": service.create_category(family_id, current.id, data)}


@router.patch("/categories/{category_id}")
def update_category(family_id: UUID, category_id: UUID, data: UpdateCategory,
                    current: CurrentUser, service: Service):
    return {"category": service.update_category(family_id, current.id, category_id, data)}


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(family_id: UUID, category_id: UUID, current: CurrentUser, service: Service):
    service.delete_category(family_id, current.id, category_id)
