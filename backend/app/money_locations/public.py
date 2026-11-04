"""Family-scoped lookup contract; no ORM entities cross module boundaries."""
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.money_locations.dependencies import Service


class LocationDirectory:
    def __init__(self, service):
        self._service = service

    def require(self, family_id: UUID, user_id: UUID, location_id: UUID) -> str:
        return self._service.require(family_id, user_id, location_id)


def directory(service: Service) -> LocationDirectory:
    return LocationDirectory(service)


Directory = Annotated[LocationDirectory, Depends(directory)]
