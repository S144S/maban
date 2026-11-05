from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.income.routes import router
from app.income.service import IncomeError


def install(app: FastAPI):
    @app.exception_handler(IncomeError)
    async def income_error(request: Request, error: IncomeError):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    app.include_router(router)
