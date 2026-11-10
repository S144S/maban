"""Plants owns plant metadata and immutable care history.

HTTP interface: /api/families/{family_id}/plants. Reminder creation validates
plant references through the read-only application interface below.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.plants.dependencies import Service


class PlantAccess:
    def __init__(self, service):
        self._service = service

    def authorize(self, family_id: UUID, user_id: UUID, plant_id: UUID) -> None:
        self._service.detail(family_id, user_id, plant_id)


def access(service: Service) -> PlantAccess:
    return PlantAccess(service)


Access = Annotated[PlantAccess, Depends(access)]
