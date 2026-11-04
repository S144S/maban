from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.families.public import Access
from app.income.service import Income


def income(request: Request, access: Access) -> Generator[Income]:
    with request.app.state.sessions.begin() as db:
        yield Income(db, access)


Service = Annotated[Income, Depends(income, scope="function")]
