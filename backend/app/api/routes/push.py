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
        if existing.data[0].get("employee_id") != payload.employee_id or existing.data[0].get("employee_name") != payload.employee_name:
            supabase.table("push_subscriptions").update({
                "employee_id": payload.employee_id,
                "employee_name": payload.employee_name,
            }).eq("id", existing.data[0]["id"]).execute()
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

def _get_admin_roles():
    return ["admin", "supervisor"]

def _get_empleados_roles(supabase) -> dict:
    """Returns dict of employee_name -> role"""
    emps = supabase.table("empleados").select("nombre,rol").execute().data or []
    return {e["nombre"]: (e.get("rol") or "employee") for e in emps}

def send_push_notification(employee_name: str, title: str, body: str, notif_type: str = "general", target: str = "admin"):
    """
    Send push notification.
    target: "admin" (admins/supervisors only), "employee" (admins + employee), "all" (everyone)
    """
    supabase = get_supabase()
    subs = supabase.table("push_subscriptions").select("*").execute().data or []
    if not subs:
        return
    admin_roles = _get_admin_roles()
    empleados_rol = _get_empleados_roles(supabase)

    notif_data = json.dumps({"title": title, "body": body, "type": notif_type, "employee": employee_name})

    for sub in subs:
        try:
            sub_name = sub.get("employee_name", "")
            role = empleados_rol.get(sub_name, "employee")

            if target == "admin" and role not in admin_roles:
                continue
            if target == "employee" and role not in admin_roles and sub_name != employee_name:
                continue

            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"],
                },
                data=notif_data,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": "mailto:francisco.ramirez@neomotic.com"},
            )
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                supabase.table("push_subscriptions").delete().eq("id", sub["id"]).execute()
