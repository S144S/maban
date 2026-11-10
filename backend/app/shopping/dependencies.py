from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.expenses.public import PurchaseExpenses
from app.families.public import Access
from app.shopping.service import Shopping


def shopping(request: Request, access: Access) -> Generator[Shopping]:
    with request.app.state.sessions.begin() as db:
        yield Shopping(db, access, PurchaseExpenses(db, access))


Service = Annotated[Shopping, Depends(shopping, scope="function")]
