from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query

from app.shopping.dependencies import Service
from app.shopping.schemas import CompleteList, CreateItem, CreateList, PurchaseStatus, UpdateItem
from app.users.public import CurrentUser

router = APIRouter(prefix="/api/families/{family_id}/shopping", tags=["shopping"])


@router.get("")
def list_items(family_id: UUID, current: CurrentUser, service: Service,
               status: Literal["pending", "purchased"] = "pending",
               offset: Annotated[int, Query(ge=0, le=1000000)] = 0, list_id: UUID | None = None):
    return service.list(family_id, current.id, status, offset, list_id)


@router.get("/lists")
def lists(family_id: UUID, current: CurrentUser, service: Service,
          offset: Annotated[int, Query(ge=0, le=1000000)] = 0):
    return service.lists(family_id, current.id, offset)


@router.post("/lists", status_code=201)
def create_list(family_id: UUID, data: CreateList, current: CurrentUser, service: Service):
    return {"list": service.create_list(family_id, current.id, data)}


@router.post("", status_code=201)
def create(family_id: UUID, data: CreateItem, current: CurrentUser, service: Service):
    return {"item": service.create(family_id, current.id, data)}


@router.post("/lists/{list_id}/complete")
def complete_list(family_id: UUID, list_id: UUID, data: CompleteList, current: CurrentUser, service: Service):
    return service.complete_list(family_id, current.id, list_id, data)


@router.put("/{item_id}")
def update(family_id: UUID, item_id: UUID, data: UpdateItem, current: CurrentUser, service: Service):
    return {"item": service.update(family_id, current.id, item_id, data)}


@router.put("/{item_id}/status")
def set_status(family_id: UUID, item_id: UUID, data: PurchaseStatus, current: CurrentUser, service: Service):
    return {"item": service.set_status(family_id, current.id, item_id, data)}


@router.delete("/{item_id}", status_code=204)
def delete(family_id: UUID, item_id: UUID, version: Annotated[int, Query(gt=0)],
           current: CurrentUser, service: Service):
    service.delete(family_id, current.id, item_id, version)
