from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.families.public import Access
from app.plants.service import Plants


def plants(request: Request, access: Access) -> Generator[Plants]:
    service = None
    try:
        with request.app.state.sessions.begin() as db:
            service = Plants(db, access, request.app.state.plant_photos)
            yield service
    except BaseException:
        if service is not None:
            service.cleanup_photos(committed=False)
        raise
    else:
        service.cleanup_photos(committed=True)


Service = Annotated[Plants, Depends(plants, scope="function")]
