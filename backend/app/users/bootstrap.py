"""Composition interface, used only by application startup."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.users.routes import router
from app.users.security import DevelopmentSms, KavenegarSms
from app.users.service import UserError


def install(app: FastAPI, settings, sms=None):
    app.state.sms = sms or (DevelopmentSms() if settings.development_otp else KavenegarSms(settings))

    @app.exception_handler(UserError)
    async def domain_error(request: Request, error: UserError):
        headers = {"Retry-After": str(error.retry_after)} if error.retry_after else {}
        return JSONResponse({"detail": error.message}, status_code=error.status, headers=headers)

    app.include_router(router)
