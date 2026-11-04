from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class CreateIncome(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_toman: Annotated[int, Field(strict=True, gt=0, le=1000000000000)]
    source: Literal["salary", "subsidy", "voucher", "gift"]
    from_member_id: UUID
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    request_id: UUID
