from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.families.routes import router
from app.families.service import FamilyError


def install(app: FastAPI):
    @app.exception_handler(FamilyError)
    async def family_error(request: Request, error: FamilyError):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    app.include_router(router)
