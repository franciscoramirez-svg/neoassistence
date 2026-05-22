from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.supabase_client import get_supabase
from app.core.config import settings
from pywebpush import webpush, WebPushException
import json

router = APIRouter(tags=["push"])

class SubscriptionRequest(BaseModel):
    endpoint: str
    keys: dict
    employee_id: str
    employee_name: str

@router.post("/push/subscribe")
def subscribe(payload: SubscriptionRequest):
    supabase = get_supabase()
    existing = supabase.table("push_subscriptions").select("id").eq("endpoint", payload.endpoint).execute()
    if existing.data:
        return {"ok": True, "message": "Ya suscrito"}
    supabase.table("push_subscriptions").insert({
        "endpoint": payload.endpoint,
        "keys": payload.keys,
        "employee_id": payload.employee_id,
        "employee_name": payload.employee_name,
    }).execute()
    return {"ok": True, "message": "Suscrito correctamente"}

@router.post("/push/unsubscribe")
def unsubscribe(payload: dict):
    endpoint = payload.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="endpoint required")
    supabase = get_supabase()
    supabase.table("push_subscriptions").delete().eq("endpoint", endpoint).execute()
    return {"ok": True}

def send_push_notification(employee_name: str, title: str, body: str):
    """Send push notification to all admin/supervisor subscriptions"""
    supabase = get_supabase()
    subs = supabase.table("push_subscriptions").select("*").execute()
    subs = subs.data or []
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"],
                },
                data=json.dumps({"title": title, "body": body}),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": "mailto:francisco.ramirez@neomotic.com"},
            )
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                supabase.table("push_subscriptions").delete().eq("id", sub["id"]).execute()
