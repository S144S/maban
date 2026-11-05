from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.income.dependencies import Service
from app.income.schemas import CreateIncome
from app.users.public import CurrentUser, Directory

router = APIRouter(prefix="/api/families/{family_id}/income", tags=["income"])


@router.get("")
def list_income(
    family_id: UUID,
    current: CurrentUser,
    service: Service,
    directory: Directory,
    offset: Annotated[int, Query(ge=0, le=1000000)] = 0,
):
    result = service.list(family_id, current.id, offset)
    profiles = directory.profiles(list({UUID(row["from_member_id"]) for row in result["entries"]}))
    for row in result["entries"]:
        profile = profiles.get(UUID(row["from_member_id"]))
        row["from_member_name"] = f"{profile.first_name} {profile.last_name}" if profile else "عضو خانواده"
    return result


@router.post("", status_code=201)
def create_income(family_id: UUID, data: CreateIncome, current: CurrentUser, service: Service):
    return {"entry": service.create(family_id, current.id, data)}


@router.get("/report")
def report(family_id: UUID, start: date, end: date, current: CurrentUser, service: Service,
           offset: Annotated[int, Query(ge=0, le=1000000)] = 0):
    if not 0 <= (end - start).days < 366 or start.year < 2000 or end.year > 2100:
        raise HTTPException(status_code=422, detail="بازهٔ گزارش باید بین ۱ تا ۳۶۶ روز باشه.")
    return service.report(family_id, current.id, start, end, offset)
