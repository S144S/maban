from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response

from app.reminders.dependencies import Service
from app.reminders.schemas import CreateReminder, ReminderFields
from app.users.public import CurrentUser

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("")
def list_reminders(current: CurrentUser, service: Service, offset: Annotated[int, Query(ge=0)] = 0):
    return service.list(current.id, offset)


@router.post("", status_code=201)
def create_reminder(data: CreateReminder, current: CurrentUser, service: Service):
    return {"reminder": service.create(current.id, data)}


@router.get("/upcoming")
def upcoming_reminders(current: CurrentUser, service: Service, offset: Annotated[int, Query(ge=0)] = 0):
    return service.upcoming(current.id, offset)


@router.put("/{reminder_id}")
def update_reminder(reminder_id: UUID, data: ReminderFields, current: CurrentUser, service: Service):
    return {"reminder": service.update(current.id, reminder_id, data)}


@router.delete("/{reminder_id}", status_code=204)
def delete_reminder(reminder_id: UUID, current: CurrentUser, service: Service):
    service.delete(current.id, reminder_id)
    return Response(status_code=204)
