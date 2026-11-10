from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlantFields(Input):
    name: Name
    species: Text = ""
    location: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    note: Note = ""
    assignee_id: UUID | None = None


class CreatePlant(PlantFields):
    request_id: UUID


class RecordCare(Input):
    request_id: UUID
    action: Literal["watered", "not_needed", "fertilized", "soil_changed", "repotted", "examined"]
    note: Note = ""
