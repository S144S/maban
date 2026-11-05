from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.investments.dependencies import Service
from app.investments.schemas import CreateInvestment, SetInvestmentRate
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


@router.get("/rates")
def rates(current: CurrentUser, service: Service):
    return service.rates(current.id)


@router.put("/rates")
def set_rate(data: SetInvestmentRate, current: CurrentUser, service: Service):
    service.set_rate(current.id, data)
    return service.rates(current.id)


@router.get("/current-summary")
def current_summary(current: CurrentUser, service: Service):
    return service.rates(current.id)["summary"]


@router.get("/report")
def report(start: date, end: date, current: CurrentUser, service: Service):
    if not 0 <= (end - start).days < 366 or start.year < 2000 or end.year > 2100:
        raise HTTPException(status_code=422, detail="بازهٔ گزارش باید بین ۱ تا ۳۶۶ روز باشه.")
    return service.report(current.id, start, end)
