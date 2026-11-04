from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.families.service import Families


def families(request: Request) -> Generator[Families]:
    with request.app.state.sessions.begin() as db:
        yield Families(db)


Service = Annotated[Families, Depends(families, scope="function")]
