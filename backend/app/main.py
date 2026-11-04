from contextlib import asynccontextmanager
from importlib.metadata import version

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import Settings
from app.database import database
from app.expenses.bootstrap import install as install_expenses
from app.families.bootstrap import install as install_families
from app.income.bootstrap import install as install_income
from app.users.bootstrap import install


def create_app(settings: Settings | None = None, sms=None):
    settings = settings or Settings()
    engine, sessions = database(settings.database_url)

    @asynccontextmanager
    async def lifespan(app):
        yield
        engine.dispose()

    app = FastAPI(title="MaBan", version=version("maban-backend"), lifespan=lifespan)
    app.state.settings, app.state.engine, app.state.sessions = settings, engine, sessions
    install(app, settings, sms)
    install_families(app)
    install_income(app)
    install_expenses(app)

    @app.middleware("http")
    async def security(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"} and (
            request.headers.get("origin") not in settings.allowed_origins
            or request.headers.get("x-maban-request") != "1"
        ):
            return JSONResponse({"detail": "درخواست از مبدأ معتبر نیست."}, status_code=403)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid_input(request: Request, error: RequestValidationError):
        # Pydantic errors contain input values, including passwords. Never return them.
        return JSONResponse(
            {"detail": "اطلاعات واردشده معتبر نیست؛ فیلدهای فرم رو بررسی کنین."}, status_code=422
        )

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": app.version}

    return app
