from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.families.public import Access
from app.plants.service import Plants


def plants(request: Request, access: Access) -> Generator[Plants]:
    with request.app.state.sessions.begin() as db:
        yield Plants(db, access)


Service = Annotated[Plants, Depends(plants, scope="function")]
