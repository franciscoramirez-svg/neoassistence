from fastapi import APIRouter
from pydantic import BaseModel
from app.services.supabase_client import get_supabase
from datetime import datetime, timedelta

router = APIRouter(tags=["notifications"])

class Notification(BaseModel):
    id: str
    title: str
    message: str
    type: str
    read: bool
    created_at: str

class MarkReadRequest(BaseModel):
    id: str

@router.get("/notifications")
def get_notifications():
    supabase = get_supabase()
    result = supabase.table("notificaciones").select("*").order("created_at", desc=True).limit(50).execute()
    return {"notifications": result.data or []}

@router.post("/notifications/read")
def mark_read(payload: MarkReadRequest):
    supabase = get_supabase()
    supabase.table("notificaciones").update({"read": True}).eq("id", payload.id).execute()
    return {"ok": True}

@router.post("/notifications")
def create_notification(payload: Notification):
    supabase = get_supabase()
    data = payload.model_dump()
    data["created_at"] = datetime.now().isoformat()
    result = supabase.table("notificaciones").insert(data).execute()
    return {"ok": True, "id": result.data[0]["id"] if result.data else None}