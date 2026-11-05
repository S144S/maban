"""Public users contract: immutable identity, never ORM objects."""

from dataclasses import dataclass
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, Request

from app.users.dependencies import COOKIE, Service
from app.users.service import Users


@dataclass(frozen=True, slots=True)
class UserIdentity:
    id: UUID
    role: Literal["user", "admin"]


def current_user(request: Request, service: Service) -> UserIdentity:
    user, _ = service.authenticate(request.cookies.get(COOKIE))
    return UserIdentity(id=user.id, role=user.role)


CurrentUser = Annotated[UserIdentity, Depends(current_user)]

__all__ = ["CurrentUser", "Directory", "UserDirectory", "UserIdentity", "UserProfile",
           "deliver_otp", "notification_phone"]


def deliver_otp(db, settings, sender, challenge_id, payload, now) -> str:
    """Worker-only interface; validate the live challenge under the phone lock."""
    return Users.deliver_otp(db, settings, sender, challenge_id, payload, now)


def notification_phone(db, user_id: UUID) -> str | None:
    """Internal notification API; only call for an authorized, user-owned notification.

    Returns a verified number only for an active account. Never expose via HTTP.
    """
    return Users.notification_phone(db, user_id)


@dataclass(frozen=True, slots=True)
class UserProfile:
    id: UUID
    first_name: str
    last_name: str


class UserDirectory:
    """Internal application API; callers must authorize their own resource first."""

    def __init__(self, service):
        self._service = service

    def profiles(self, ids: list[UUID]) -> dict[UUID, UserProfile]:
        if len(ids) > 100:
            raise ValueError("At most 100 profiles per call")
        return {
            row.id: UserProfile(row.id, row.first_name, row.last_name)
            for row in self._service.profile_summaries(ids)
        }


def directory(service: Service) -> UserDirectory:
    return UserDirectory(service)


Directory = Annotated[UserDirectory, Depends(directory)]
