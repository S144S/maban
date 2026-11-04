from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.expenses.routes import router
from app.expenses.service import ExpenseError


def install(app: FastAPI):
    @app.exception_handler(ExpenseError)
    async def expenses_error(request: Request, error: ExpenseError):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    app.include_router(router)
