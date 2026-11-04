from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateFamily(Input):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class CreateInvitation(Input):
    access: Literal["full", "view"] = "view"
    relationship: Literal["spouse", "child", "friend"]


class InvitationToken(Input):
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
