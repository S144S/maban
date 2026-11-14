from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.families.service import Families


def families(request: Request) -> Generator[Families]:
    with request.app.state.sessions.begin() as db:
        yield Families(db, on_member_joined=request.app.state.on_family_member_joined)


Service = Annotated[Families, Depends(families, scope="function")]
