from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Price = Annotated[int, Field(strict=True, gt=0, le=1000000000000)]


class CreateInvestment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["gold"]
    grams: Annotated[Decimal, Field(gt=0, le=1000000, max_digits=10, decimal_places=3)]
    unit_price_toman: Price | None = None
    total_price_toman: Price | None = None
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    request_id: UUID
