from fastapi import Request
from fastapi.responses import JSONResponse

from app.wallets.errors import WalletError
from app.wallets.payments import Zarinpal
from app.wallets.routes import router


def install(app):
    app.state.payment_gateway = Zarinpal(app.state.settings)

    @app.exception_handler(WalletError)
    async def wallet_error(request: Request, error: WalletError):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    app.include_router(router)
