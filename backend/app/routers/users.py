from fastapi import APIRouter, Depends

from app.core.rbac import CurrentUser, require_role

router = APIRouter(prefix="/users", tags=["users"])


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
