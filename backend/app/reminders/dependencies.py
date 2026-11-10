from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, Request

from app.plants.public import Access
from app.reminders.service import Reminders


def reminders(request: Request, plants: Access) -> Generator[Reminders]:
    with request.app.state.sessions.begin() as db:
        yield Reminders(db, plants, request.app.state.settings.reminder_sms_enabled)


Service = Annotated[Reminders, Depends(reminders, scope="function")]
