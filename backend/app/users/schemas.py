import re
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def digits(value: str) -> str:
    if not isinstance(value, str):
        return value
    return value.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))


def phone(value: str) -> str:
    if not isinstance(value, str):
        return value
    return re.sub(r"[\s-]", "", digits(value))


Phone = Annotated[str, BeforeValidator(phone), Field(pattern=r"^09[0-9]{9}$")]
Password = Annotated[str, Field(min_length=8, max_length=128)]
Name = Annotated[
    str, BeforeValidator(lambda v: v.strip() if isinstance(v, str) else v), Field(min_length=1, max_length=80)
]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class OtpRequest(Input):
    phone: Phone
    purpose: Literal["login", "signup", "recovery"]


class OtpVerify(Input):
    challenge_id: UUID
    code: Annotated[str, BeforeValidator(digits), Field(pattern=r"^[0-9]{5}$")]


class Register(Input):
    proof: str = Field(min_length=32, max_length=128)
    first_name: Name
    last_name: Name
    password: Password


class PasswordLogin(Input):
    phone: Phone
    password: str = Field(min_length=1, max_length=128)


class ResetPassword(Input):
    proof: str = Field(min_length=32, max_length=128)
    password: Password


class ProfileUpdate(Input):
    first_name: Name
    last_name: Name


class PasswordChange(Input):
    current_password: str = Field(min_length=1, max_length=128)
    password: Password


class AdminUpdate(Input):
    active: bool
    role: Literal["user", "admin"]
