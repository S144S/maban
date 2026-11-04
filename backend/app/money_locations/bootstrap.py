from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.money_locations.routes import router
from app.money_locations.service import LocationError


def install(app: FastAPI):
    @app.exception_handler(LocationError)
    async def location_error(request: Request, error: LocationError):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    app.include_router(router)
