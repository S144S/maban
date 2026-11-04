from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


class CreateExpense(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_toman: Annotated[int, Field(strict=True, gt=0, le=1000000000000)]
    category: Literal["home", "groceries", "leisure", "other"] | None = None
    category_id: UUID | None = None
    paid_by_member_id: UUID
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    request_id: UUID


    @model_validator(mode="after")
    def category_choice(self):
        if (self.category is None) == (self.category_id is None):
            raise ValueError("Supply exactly one category or category_id")
        return self


CategoryIcon = Literal["tag", "house", "shopping-basket", "utensils", "car", "bus", "heart-pulse", "graduation-cap", "shirt", "gamepad-2", "gift", "plane", "receipt", "wrench", "baby", "paw-print"]


class UpdateCategory(BaseModel):
    icon: CategoryIcon = "tag"
    model_config = ConfigDict(extra="forbid")
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class CreateCategory(UpdateCategory):
    request_id: UUID
