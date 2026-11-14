from typing import Annotated

from fastapi import Depends, Request

from app.wallets.service import Wallets


def wallets(request: Request):
    with request.app.state.sessions.begin() as db:
        yield Wallets(db, request.app.state.settings, request.app.state.payment_gateway)


Service = Annotated[Wallets, Depends(wallets, scope="function")]
