from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.assets.routes import router
from app.assets.service import AssetError


def install(app: FastAPI):
    @app.exception_handler(AssetError)
    async def asset_error(request: Request, error: AssetError):
        return JSONResponse({"detail": error.message}, status_code=409)

    app.include_router(router)
