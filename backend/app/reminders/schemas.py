from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, field_validator


class ReminderFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    due_at: AwareDatetime
    recurrence: Literal["none", "daily", "weekly", "monthly"] = "none"
    amount_toman: Annotated[int, Field(strict=True, gt=0, le=1_000_000_000_000)] | None = None

    @field_validator("due_at", mode="before")
    @classmethod
    def require_iso_date(cls, value):
        if not isinstance(value, (str, datetime)):
            # Pydantic converts ValueError to 422; TypeError would escape as a 500.
            raise ValueError("An explicit date and timezone are required")  # noqa: TRY004
        return value

    @field_validator("due_at")
    @classmethod
    def date_range(cls, value):
        value = value.astimezone(UTC)
        if not 2020 <= value.year <= 2120:
            raise ValueError("Date must be between 2020 and 2120")
        return value


class CreateReminder(ReminderFields):
    request_id: UUID
