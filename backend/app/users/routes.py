from uuid import UUID

from fastapi import APIRouter, Query, Request, Response

from app.users import schemas
from app.users.dependencies import COOKIE, Administrator, CurrentUser, Service
from app.users.service import user_view

router = APIRouter(prefix="/api", tags=["users"])


def ip(request: Request):
    # Only trust ASGI's peer address. Configure uvicorn trusted proxies explicitly in deployment.
    return request.client.host if request.client else "unknown"


def start_session(service, user, request, response):
    token = service.session(user, request.headers.get("user-agent", ""), request.cookies.get(COOKIE))
    response.set_cookie(
        COOKIE,
        token,
        max_age=service.settings.session_seconds,
        httponly=True,
        secure=service.settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return {"user": user_view(user)}


@router.get("/auth/config")
def config(service: Service):
    return {"development_otp": service.settings.development_otp}


@router.post("/auth/otp/request")
def request_otp(data: schemas.OtpRequest, request: Request, service: Service):
    return service.request_otp(data.phone, data.purpose, ip(request))


@router.post("/auth/otp/verify")
def verify_otp(data: schemas.OtpVerify, request: Request, response: Response, service: Service):
    user, proof = service.verify_otp(data.challenge_id, data.code, ip(request))
    if user:
        return start_session(service, user, request, response)
    return {"proof": proof}


@router.post("/auth/register", status_code=201)
def register(data: schemas.Register, request: Request, response: Response, service: Service):
    return start_session(service, service.register(data), request, response)


@router.post("/auth/login")
def login(data: schemas.PasswordLogin, request: Request, response: Response, service: Service):
    user = service.password_login(data.phone, data.password, ip(request))
    return start_session(service, user, request, response)


@router.post("/auth/reset-password")
def reset_password(data: schemas.ResetPassword, response: Response, service: Service):
    service.reset_password(data.proof, data.password)
    response.delete_cookie(COOKIE, path="/")
    return {"message": "رمز عبور تغییر کرد؛ با رمز جدید وارد بشین."}


@router.post("/auth/logout")
def logout(request: Request, response: Response, service: Service):
    token = request.cookies.get(COOKIE)
    if token:
        service.logout(token)
    response.delete_cookie(COOKIE, path="/")
    return {"message": "از حساب خارج شدین."}


@router.get("/users/me")
def me(current: CurrentUser):
    return {"user": user_view(current[0])}


@router.patch("/users/me")
def profile(data: schemas.ProfileUpdate, current: CurrentUser, service: Service):
    return {"user": service.update_profile(current[0], data.first_name, data.last_name)}


@router.post("/users/me/password")
def change_password(data: schemas.PasswordChange, current: CurrentUser, service: Service, response: Response):
    service.change_password(current[0], data.current_password, data.password)
    response.delete_cookie(COOKIE, path="/")
    return {"message": "رمز تغییر کرد و همهٔ نشست‌ها بسته شدن؛ دوباره وارد بشین."}


@router.get("/users/me/sessions")
def sessions(current: CurrentUser, service: Service):
    return service.list_sessions(*current)


@router.delete("/users/me/sessions/others")
def revoke_others(current: CurrentUser, service: Service):
    service.revoke_other_sessions(*current)
    return {"message": "نشست‌های دیگه بسته شدن."}


@router.delete("/users/me/sessions/{session_id}")
def revoke_session(session_id: UUID, current: CurrentUser, service: Service, response: Response):
    service.revoke_session(current[0], session_id)
    if session_id == current[1].id:
        response.delete_cookie(COOKIE, path="/")
    return {"message": "نشست بسته شد."}


@router.get("/admin/users")
def list_users(
    admin: Administrator, service: Service, page: int = Query(1, ge=1), search: str = Query("", max_length=80)
):
    return service.list_users(page, search)


@router.patch("/admin/users/{user_id}")
def update_user(user_id: UUID, data: schemas.AdminUpdate, admin: Administrator, service: Service):
    return {"user": user_view(service.admin_update(admin[0], user_id, data.active, data.role))}
