from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Version = Annotated[int, Field(strict=True, gt=0)]


class ItemFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    quantity: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] = ""


class CreateItem(ItemFields):
    request_id: UUID
    list_id: UUID | None = None


class CreateList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    request_id: UUID
    items: Annotated[list[ItemFields], Field(max_length=100)] = Field(default_factory=list)


class UpdateItem(ItemFields):
    version: Version


class PurchaseStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purchased: Annotated[bool, Field(strict=True)]
    version: Version
    amount_toman: Annotated[int, Field(strict=True, gt=0, le=1000000000000)] | None = None
    category_id: UUID | None = None

    @model_validator(mode="after")
    def expense_choice(self):
        if not self.purchased and (self.amount_toman is not None or self.category_id is not None):
            raise ValueError("An expense requires a purchase")
        if self.category_id is not None and self.amount_toman is None:
            raise ValueError("A category requires an amount")
        return self


class CompleteList(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    token: Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
    amount_toman: Annotated[int, Field(strict=True, gt=0, le=1000000000000)] | None = None
    category_id: UUID | None = None

    @model_validator(mode="after")
    def expense_choice(self):
        if self.category_id is not None and self.amount_toman is None:
            raise ValueError("A category requires an amount")
        return self
