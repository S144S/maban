from uuid import UUID

from fastapi import APIRouter

from app.families.dependencies import Service
from app.families.schemas import CreateFamily, CreateInvitation, InvitationToken
from app.users.public import CurrentUser, Directory

router = APIRouter(prefix="/api/families", tags=["families"])


@router.get("")
def list_families(current: CurrentUser, service: Service):
    return {"families": service.list(current.id)}


@router.post("", status_code=201)
def create(data: CreateFamily, current: CurrentUser, service: Service):
    return {"family": service.create(current.id, data.name)}


@router.post("/invitations/preview")
def preview(data: InvitationToken, current: CurrentUser, service: Service):
    return service.preview(data.token, current.id)


@router.post("/invitations/accept")
def accept(data: InvitationToken, current: CurrentUser, service: Service):
    return service.accept(data.token, current.id)


@router.get("/{family_id}")
def detail(family_id: UUID, current: CurrentUser, service: Service, directory: Directory):
    family, members = service.detail(family_id, current.id)
    profiles = directory.profiles([UUID(m["user_id"]) for m in members])
    for member in members:
        profile = profiles.get(UUID(member["user_id"]))
        member["name"] = f"{profile.first_name} {profile.last_name}" if profile else "کاربر مابان"
    return {"family": family, "members": members}


@router.get("/{family_id}/invitations")
def invitations(family_id: UUID, current: CurrentUser, service: Service):
    return {"invitations": service.invitations(family_id, current.id)}


@router.post("/{family_id}/invitations", status_code=201)
def invite(family_id: UUID, data: CreateInvitation, current: CurrentUser, service: Service):
    return service.invite(family_id, current.id, data.relationship, data.access)


@router.delete("/{family_id}/invitations/{invite_id}")
def revoke(family_id: UUID, invite_id: UUID, current: CurrentUser, service: Service):
    service.revoke(family_id, invite_id, current.id)
    return {"message": "دعوت لغو شد."}
