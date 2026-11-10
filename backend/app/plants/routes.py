from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request, Response
from starlette.concurrency import run_in_threadpool

from app.plants.dependencies import Service
from app.plants.errors import PlantError
from app.plants.photos import MAX_UPLOAD_BYTES
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


@router.get("/{plant_id}/photo")
def photo(family_id: UUID, plant_id: UUID, current: CurrentUser, service: Service):
    return Response(service.photo(family_id, current.id, plant_id), media_type="image/jpeg",
                    headers={"Content-Disposition": 'inline; filename="plant.jpg"'})


@router.put("/{plant_id}/photo")
async def upload_photo(family_id: UUID, plant_id: UUID, current: CurrentUser, service: Service,
                       request: Request):
    await run_in_threadpool(service.detail, family_id, current.id, plant_id)
    # Read a bounded raw image body; do not buffer unbounded files or trust Content-Length.
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_UPLOAD_BYTES:
            raise PlantError("حجم عکس باید حداکثر ۵ مگابایت باشه.", 413)
        data.extend(chunk)
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    plant = await run_in_threadpool(service.set_photo, family_id, current.id, plant_id,
                                   bytes(data), content_type)
    return {"plant": plant}


@router.delete("/{plant_id}/photo", status_code=204)
def remove_photo(family_id: UUID, plant_id: UUID, current: CurrentUser, service: Service):
    service.remove_photo(family_id, current.id, plant_id)


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
        event["actor_name"] = profile.first_name if profile else "عضو خانواده"
    return result
