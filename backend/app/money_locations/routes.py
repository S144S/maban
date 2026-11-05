from uuid import UUID

from fastapi import APIRouter, Response

from app.money_locations.dependencies import Service
from app.money_locations.schemas import CreateLocation, RenameLocation
from app.users.public import CurrentUser

router = APIRouter(prefix="/api/families/{family_id}/money-locations", tags=["money-locations"])


@router.get("")
def list_locations(family_id: UUID, current: CurrentUser, service: Service):
    return service.list(family_id, current.id)


@router.post("", status_code=201)
def create_location(family_id: UUID, data: CreateLocation, current: CurrentUser, service: Service):
    return {"location": service.create(family_id, current.id, data)}


@router.patch("/{location_id}")
def rename_location(family_id: UUID, location_id: UUID, data: RenameLocation,
                    current: CurrentUser, service: Service):
    return {"location": service.rename(family_id, current.id, location_id, data)}


@router.delete("/{location_id}", status_code=204)
def delete_location(family_id: UUID, location_id: UUID, current: CurrentUser, service: Service):
    service.delete(family_id, current.id, location_id)
    return Response(status_code=204)
