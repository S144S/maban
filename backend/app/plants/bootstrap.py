from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.plants.routes import router
from app.plants.service import PlantError


def install(app: FastAPI):
    @app.exception_handler(PlantError)
    async def plant_error(request: Request, error: PlantError):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    app.include_router(router)
