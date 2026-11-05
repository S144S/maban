from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.reminders.service import Reminders


def reminders(request: Request) -> Generator[Reminders]:
    with request.app.state.sessions.begin() as db:
        yield Reminders(db, request.app.state.settings.reminder_sms_enabled)


Service = Annotated[Reminders, Depends(reminders, scope="function")]
