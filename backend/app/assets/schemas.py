from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class AssetInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purchase_price_toman: Annotated[int, Field(strict=True, gt=0, le=1000000000000)] | None = None
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    request_id: UUID


class CreateProperty(AssetInput):
    kind: Literal["house", "land"]
    price_per_sqm_toman: Annotated[int, Field(strict=True, gt=0, le=1000000000000)] | None = None
    title: Name
    location: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    area_sqm: Annotated[Decimal, Field(gt=0, le=1000000000, max_digits=12, decimal_places=2)]


class CreateCar(AssetInput):
    kind: Literal["car"]
    brand: Name | None = None
    model: Name
    year_calendar: Literal["solar", "gregorian"]
    manufacture_year: Annotated[int, Field(strict=True)]

    @model_validator(mode="after")
    def valid_year(self):
        minimum, maximum = (1200, 1500) if self.year_calendar == "solar" else (1886, 2100)
        if not minimum <= self.manufacture_year <= maximum:
            raise ValueError("Invalid manufacture year for selected calendar")
        return self


CreateAsset = Annotated[CreateProperty | CreateCar, Field(discriminator="kind")]


class SetAssetRate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    unit_price_toman: Annotated[int, Field(strict=True, gt=0, le=1000000000000)] | None
