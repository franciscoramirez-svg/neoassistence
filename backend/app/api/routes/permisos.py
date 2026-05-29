from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.services.supabase_client import get_supabase
from app.core.config import settings

router = APIRouter(tags=["permisos"])

class PermisoCreate(BaseModel):
    empleado_nombre: str
    tipo: str = "permiso"
    fecha_inicio: str
    fecha_fin: str
    motivo: str = ""

class PermisoResolve(BaseModel):
    estatus: str
    admin_comentario: str = ""

@router.post("/permisos")
def create_permiso(payload: PermisoCreate):
    supabase = get_supabase()
    emp = supabase.table("empleados").select("id").eq("nombre", payload.empleado_nombre).limit(1).execute()
    empleado_id = emp.data[0]["id"] if emp.data else None
    data = {
        "empleado_id": empleado_id,
        "empleado_nombre": payload.empleado_nombre,
        "tipo": payload.tipo,
        "fecha_inicio": payload.fecha_inicio,
        "fecha_fin": payload.fecha_fin,
        "motivo": payload.motivo,
    }
    result = supabase.table("permisos").insert(data).execute()
    if result.data:
        return {"ok": True, "id": result.data[0]["id"]}
    raise HTTPException(status_code=400, detail="Error al crear permiso")

@router.get("/permisos")
def list_permisos(estatus: Optional[str] = None, empleado: Optional[str] = None):
    supabase = get_supabase()
    q = supabase.table("permisos").select("*").order("created_at", desc=True)
    if estatus:
        q = q.eq("estatus", estatus)
    if empleado:
        q = q.eq("empleado_nombre", empleado)
    result = q.execute()
    return result.data or []

@router.get("/permisos/stats")
def permiso_stats():
    supabase = get_supabase()
    all_ = supabase.table("permisos").select("*").execute().data or []
    pendientes = sum(1 for i in all_ if i.get("estatus") == "pendiente")
    aprobadas = sum(1 for i in all_ if i.get("estatus") == "aprobado")
    rechazadas = sum(1 for i in all_ if i.get("estatus") == "rechazado")
    return {"pendientes": pendientes, "aprobadas": aprobadas, "rechazadas": rechazadas, "total": len(all_)}

@router.put("/permisos/{perm_id}/resolver")
def resolve_permiso(perm_id: str, payload: PermisoResolve):
    supabase = get_supabase()
    perm = supabase.table("permisos").select("*").eq("id", perm_id).limit(1).execute()
    if not perm.data:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    current = perm.data[0]
    if current.get("estatus") == payload.estatus:
        return {"ok": True, "idempotent": True}

    supabase.table("permisos").update({
        "estatus": payload.estatus,
        "admin_comentario": payload.admin_comentario,
        "resuelta_at": datetime.now().isoformat(),
    }).eq("id", perm_id).execute()

    try:
        from app.api.routes.push import send_push_notification
        send_push_notification(
            current["empleado_nombre"],
            f"Permiso {payload.estatus}",
            f"Tu permiso fue {payload.estatus}. {payload.admin_comentario}" if payload.admin_comentario else f"Tu permiso fue {payload.estatus}",
            notif_type="permiso",
            target="employee",
        )
    except:
        pass

    try:
        from app.services.auto_reports import send_notification_email
        nombre = current["empleado_nombre"]
        send_notification_email(
            settings.smtp_user,
            f"Permiso {payload.estatus} - {nombre}",
            f"Hola {nombre},\n\nTu permiso ha sido {payload.estatus}.\n"
            f"Tipo: {current.get('tipo', 'N/A')}\n"
            f"Fechas: {current.get('fecha_inicio', '')} a {current.get('fecha_fin', '')}\n"
            f"{'Comentario: ' + payload.admin_comentario if payload.admin_comentario else ''}\n\n-- NeoAssistence"
        )
    except:
        pass

    return {"ok": True}
