from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateTopup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    amount_toman: int = Field(strict=True, ge=10000, le=10000000)
