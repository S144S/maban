from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Interval = Annotated[int, Field(strict=True, ge=1, le=365)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlantFields(Input):
    name: Name
    species: Text = ""
    location: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    note: Note = ""
    assignee_id: UUID | None = None
    soil_interval: Interval
    soil_due: date
    fertilizer_interval: Interval | None = None
    fertilizer_due: date | None = None

    @field_validator("soil_due", "fertilizer_due", mode="before")
    @classmethod
    def explicit_date(cls, value):
        if value is not None and (not isinstance(value, (str, date)) or isinstance(value, bool)):
            raise ValueError("Use an ISO calendar date")
        return value

    @field_validator("soil_due", "fertilizer_due")
    @classmethod
    def supported_date(cls, value):
        if value is not None and not 2024 <= value.year <= 2120:
            raise ValueError("Unsupported date")
        return value

    @model_validator(mode="after")
    def paired_schedule(self):
        if (self.fertilizer_interval is None) != (self.fertilizer_due is None):
            raise ValueError("Fertilizer interval and date are required together")
        return self


class CreatePlant(PlantFields):
    request_id: UUID


class RecordCare(Input):
    request_id: UUID
    action: Literal["watered", "not_needed", "fertilized"]
    note: Note = ""
