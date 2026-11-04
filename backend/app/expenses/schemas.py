from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class CreateExpense(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_toman: Annotated[int, Field(strict=True, gt=0, le=1000000000000)]
    category: Literal["home", "groceries", "leisure", "other"]
    paid_by_member_id: UUID
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    request_id: UUID
