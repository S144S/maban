from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.plants.dependencies import Service
from app.plants.schemas import CreatePlant, PlantFields, RecordCare
from app.users.public import CurrentUser, Directory

router = APIRouter(prefix="/api/families/{family_id}/plants", tags=["plants"])
Offset = Annotated[int, Query(ge=0, le=1000000)]


@router.get("")
def list_plants(family_id: UUID, current: CurrentUser, service: Service, offset: Offset = 0):
    return service.list(family_id, current.id, offset)


@router.post("", status_code=201)
def create(family_id: UUID, data: CreatePlant, current: CurrentUser, service: Service):
    return {"plant": service.create(family_id, current.id, data)}


@router.get("/{plant_id}")
def detail(family_id: UUID, plant_id: UUID, current: CurrentUser, service: Service):
    return service.detail(family_id, current.id, plant_id)


@router.put("/{plant_id}")
def update(family_id: UUID, plant_id: UUID, data: PlantFields, current: CurrentUser, service: Service):
    return {"plant": service.update(family_id, current.id, plant_id, data)}


@router.delete("/{plant_id}", status_code=204)
def delete(family_id: UUID, plant_id: UUID, current: CurrentUser, service: Service):
    service.delete(family_id, current.id, plant_id)


@router.post("/{plant_id}/care", status_code=201)
def care(family_id: UUID, plant_id: UUID, data: RecordCare, current: CurrentUser, service: Service):
    return {"event": service.care(family_id, current.id, plant_id, data)}


@router.get("/{plant_id}/history")
def history(family_id: UUID, plant_id: UUID, current: CurrentUser, service: Service,
            directory: Directory, offset: Offset = 0):
    result = service.history(family_id, current.id, plant_id, offset)
    profiles = directory.profiles(list({UUID(event["actor_id"]) for event in result["events"]}))
    for event in result["events"]:
        profile = profiles.get(UUID(event["actor_id"]))
        event["actor_name"] = f"{profile.first_name} {profile.last_name}" if profile else "عضو خانواده"
    return result
