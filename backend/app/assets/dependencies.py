from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.assets.service import Assets


def assets(request: Request) -> Generator[Assets]:
    with request.app.state.sessions.begin() as db:
        yield Assets(db)


Service = Annotated[Assets, Depends(assets, scope="function")]
