from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.families.public import Access
from app.money_locations.service import Locations


def locations(request: Request, access: Access) -> Generator[Locations]:
    with request.app.state.sessions.begin() as db:
        yield Locations(db, access)


Service = Annotated[Locations, Depends(locations, scope="function")]
