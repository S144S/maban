from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.reminders.routes import router
from app.reminders.service import ReminderError


def install(app: FastAPI):
    @app.exception_handler(ReminderError)
    async def reminder_error(request: Request, error: ReminderError):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    app.include_router(router)
