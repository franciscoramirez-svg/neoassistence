from fastapi import APIRouter

from app.services.branches import list_branches


router = APIRouter(tags=["branches"])


@router.get("/branches")
def get_branches():
    return {"ok": True, "message": "ok", "data": list_branches()}