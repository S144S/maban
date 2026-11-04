from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.investments.service import Investments


def investments(request: Request) -> Generator[Investments]:
    with request.app.state.sessions.begin() as db:
        yield Investments(db)


Service = Annotated[Investments, Depends(investments, scope="function")]
