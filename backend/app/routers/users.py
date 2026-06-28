from fastapi import APIRouter, Depends

from app.core.rbac import CurrentUser, get_current_user, require_role

router = APIRouter(prefix="/users", tags=["users"])
api_router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me")
def get_current_user_profile(
    user: CurrentUser = Depends(require_role(["employee", "hr", "admin"])),
) -> dict:
    return {"email": user.email, "role": user.role}


@router.get("/hr-only")
def hr_only(
    user: CurrentUser = Depends(require_role(["hr", "admin"])),
) -> dict:
    return {"ok": True, "role": user.role}


@api_router.get("/me")
def get_me(user: CurrentUser = Depends(get_current_user)) -> dict:
    return {"email": user.email, "role": user.role}
