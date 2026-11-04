from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.families.public import Access
from app.income.service import Income
from app.money_locations.public import Directory


def income(request: Request, access: Access, locations: Directory) -> Generator[Income]:
    with request.app.state.sessions.begin() as db:
        yield Income(db, access, locations)


Service = Annotated[Income, Depends(income, scope="function")]
