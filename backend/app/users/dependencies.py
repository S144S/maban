"""Internal HTTP dependencies and transaction boundaries."""

from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.users.models import LoginSession, User
from app.users.service import UserError, Users, lock

COOKIE = "maban_session"


def users(request: Request) -> Generator[Users]:
    with request.app.state.sessions() as db:
        service = Users(db, request.app.state.settings)
        try:
            yield service
        except UserError:
            # Failed verification and rate-limit attempts must survive error responses.
            db.commit()
            raise
        except Exception:
            db.rollback()
            raise
        else:
            db.commit()


Service = Annotated[Users, Depends(users, scope="function")]


def current_user(request: Request, service: Service):
    return service.authenticate(request.cookies.get(COOKIE))


CurrentUser = Annotated[tuple[User, LoginSession], Depends(current_user)]


def administrator(request: Request, service: Service):
    # Order admin writes before user locks to prevent cross-admin deadlocks.
    lock(service.db, "admin-management")
    user, session = service.authenticate(request.cookies.get(COOKIE))
    if user.role != "admin":
        raise UserError("دسترسی به این بخش فقط برای مدیر حسابه.", 403)
    return user, session


Administrator = Annotated[tuple[User, LoginSession], Depends(administrator)]
