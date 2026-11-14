from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.shopping.routes import router
from app.shopping.service import ShoppingError


def install(app: FastAPI):
    @app.exception_handler(ShoppingError)
    async def shopping_error(request: Request, error: ShoppingError):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    app.include_router(router)
