from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request
from fastapi.responses import RedirectResponse

from app.families.public import Access
from app.users.public import CurrentUser
from app.wallets.dependencies import Service
from app.wallets.errors import WalletError
from app.wallets.schemas import CreateTopup

router = APIRouter(prefix="/api", tags=["wallet"])


@router.get("/families/{family_id}/wallet")
def summary(family_id: UUID, current: CurrentUser, service: Service, families: Access):
    families.authorize(family_id, current.id)
    return service.summary(family_id)


@router.get("/families/{family_id}/wallet/entries")
def entries(family_id: UUID, current: CurrentUser, service: Service, families: Access, offset: Annotated[int, Query(ge=0)] = 0):
    families.authorize(family_id, current.id)
    return service.entries(family_id, offset)


@router.get("/families/{family_id}/wallet/topups")
def topups(family_id: UUID, current: CurrentUser, service: Service, families: Access, offset: Annotated[int, Query(ge=0)] = 0):
    families.authorize(family_id, current.id)
    return service.topups(family_id, offset)


@router.post("/families/{family_id}/wallet/topups", status_code=201)
def create(data: CreateTopup, family_id: UUID, current: CurrentUser, service: Service, families: Access):
    families.authorize(family_id, current.id)
    return service.create_topup(family_id, data, current.id)


@router.post("/families/{family_id}/wallet/topups/{topup_id}/verify")
def verify(topup_id: UUID, family_id: UUID, current: CurrentUser, service: Service, families: Access):
    families.authorize(family_id, current.id)
    return service.verify(family_id=family_id, topup_id=topup_id)


@router.get("/wallet/callback")
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
    family_id = service.callback_family(authority)
    family_query = "&family=" + str(family_id) if family_id else ""
    return RedirectResponse(request.app.state.settings.allowed_origins[0] + "/wallet?payment=" + result + family_query,
                            status_code=303)
