from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.expenses.service import Expense
from app.families.public import Access


def expenses(request: Request, access: Access) -> Generator[Expense]:
    with request.app.state.sessions.begin() as db:
        yield Expense(db, access)


Service = Annotated[Expense, Depends(expenses, scope="function")]
