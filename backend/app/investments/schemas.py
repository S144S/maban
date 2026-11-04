from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Price = Annotated[int, Field(strict=True, gt=0, le=1000000000000)]


class InvestmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    unit_price_toman: Price | None = None
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    request_id: UUID


class CreateGold(InvestmentInput):
    kind: Literal["gold"]
    grams: Annotated[Decimal, Field(gt=0, le=1000000, max_digits=10, decimal_places=3)]
    total_price_toman: Price | None = None


class CreateStock(InvestmentInput):
    kind: Literal["stock"]
    symbol: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    shares: Annotated[int, Field(strict=True, gt=0, le=1000000000)]


class CreateSilver(InvestmentInput):
    kind: Literal["silver"]
    grams: Annotated[Decimal, Field(gt=0, le=1000000, max_digits=10, decimal_places=3)]


class CreateCrypto(InvestmentInput):
    kind: Literal["crypto"]
    symbol: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    quantity: Annotated[Decimal, Field(gt=0, le=1000000000, max_digits=28, decimal_places=18)]


class CreateCurrency(InvestmentInput):
    kind: Literal["currency"]
    symbol: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    quantity: Annotated[Decimal, Field(gt=0, le=1000000000, max_digits=12, decimal_places=2)]


class CreateBond(InvestmentInput):
    kind: Literal["bond"]
    symbol: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    quantity: Annotated[int, Field(strict=True, gt=0, le=1000000000)]


CreateInvestment = Annotated[
    CreateGold | CreateStock | CreateSilver | CreateCrypto | CreateCurrency | CreateBond,
    Field(discriminator="kind"),
]
