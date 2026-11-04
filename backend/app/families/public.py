"""Read-only authorization contract; no ORM entities leave this module."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.families.dependencies import Service


class FamilyAccess:
    def __init__(self, service):
        self._service = service

    def authorize(self, family_id: UUID, user_id: UUID) -> None:
        self._service.require_member(family_id, user_id)

    def require_owner(self, family_id: UUID, user_id: UUID) -> None:
        self._service.require_owner(family_id, user_id)

    def require_member(self, family_id: UUID, member_id: UUID) -> None:
        self._service.require_member(family_id, member_id)


def access(service: Service) -> FamilyAccess:
    return FamilyAccess(service)


Access = Annotated[FamilyAccess, Depends(access)]
