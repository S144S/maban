from uuid import UUID

from fastapi import APIRouter

from app.money_locations.dependencies import Service
from app.money_locations.schemas import CreateLocation
from app.users.public import CurrentUser

router = APIRouter(prefix="/api/families/{family_id}/money-locations", tags=["money-locations"])


@router.get("")
def list_locations(family_id: UUID, current: CurrentUser, service: Service):
    return service.list(family_id, current.id)


@router.post("", status_code=201)
def create_location(family_id: UUID, data: CreateLocation, current: CurrentUser, service: Service):
    return {"location": service.create(family_id, current.id, data)}
