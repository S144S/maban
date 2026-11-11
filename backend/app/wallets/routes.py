from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request
from fastapi.responses import RedirectResponse

from app.users.public import CurrentUser
from app.wallets.dependencies import Service
from app.wallets.errors import WalletError
from app.wallets.schemas import CreateTopup

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


@router.get("")
def summary(current: CurrentUser, service: Service):
    return service.summary(current.id)


@router.get("/entries")
def entries(current: CurrentUser, service: Service, offset: Annotated[int, Query(ge=0)] = 0):
    return service.entries(current.id, offset)


@router.get("/topups")
def topups(current: CurrentUser, service: Service, offset: Annotated[int, Query(ge=0)] = 0):
    return service.topups(current.id, offset)


@router.post("/topups", status_code=201)
def create(data: CreateTopup, current: CurrentUser, service: Service):
    return service.create_topup(current.id, data)


@router.post("/topups/{topup_id}/verify")
def verify(topup_id: UUID, current: CurrentUser, service: Service):
    return service.verify(user_id=current.id, topup_id=topup_id)


@router.get("/callback")
def callback(request: Request, service: Service,
             authority: Annotated[str, Query(alias="Authority", pattern=r"^[A-Za-z0-9]{36}$")],
             status: Annotated[str, Query(alias="Status", max_length=10)] = ""):
    # A callback is only a hint. Credit requires server-to-server verification of the stored amount.
    result = "unconfirmed"
    if status == "OK":
        try:
            service.verify(authority=authority)
            result = "confirmed"
        except WalletError:
            pass
    return RedirectResponse(request.app.state.settings.allowed_origins[0] + "/wallet?payment=" + result,
                            status_code=303)
