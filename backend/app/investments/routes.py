from typing import Annotated

from fastapi import APIRouter, Query

from app.investments.dependencies import Service
from app.investments.schemas import CreateInvestment
from app.users.public import CurrentUser

router = APIRouter(prefix="/api/investments", tags=["investments"])


@router.get("")
def list_investments(current: CurrentUser, service: Service,
                     offset: Annotated[int, Query(ge=0, le=1000000)] = 0):
    return service.list(current.id, offset)


@router.post("", status_code=201)
def create_investment(data: CreateInvestment, current: CurrentUser, service: Service):
    return {"entry": service.create(current.id, data)}


@router.get("/summary")
def summary(current: CurrentUser, service: Service):
    return service.summary(current.id)
