from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.investments.routes import router
from app.investments.service import InvestmentError


def install(app: FastAPI):
    @app.exception_handler(InvestmentError)
    async def investment_error(request: Request, error: InvestmentError):
        return JSONResponse({"detail": error.message}, status_code=409)

    app.include_router(router)
