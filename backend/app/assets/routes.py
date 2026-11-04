from typing import Annotated

from fastapi import APIRouter, Query

from app.assets.dependencies import Service
from app.assets.schemas import CreateAsset
from app.users.public import CurrentUser

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("")
def list_assets(current: CurrentUser, service: Service,
                     offset: Annotated[int, Query(ge=0, le=1000000)] = 0):
    return service.list(current.id, offset)


@router.post("", status_code=201)
def create_asset(data: CreateAsset, current: CurrentUser, service: Service):
    return {"entry": service.create(current.id, data)}


@router.get("/summary")
def summary(current: CurrentUser, service: Service):
    return service.summary(current.id)
