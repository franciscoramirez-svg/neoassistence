from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.services.supabase_client import get_supabase

router = APIRouter(tags=["incidencias"])

class IncidenciaCreate(BaseModel):
    empleado_nombre: str
    tipo: str = "retardo"
    fecha: str
    hora: str = ""
    motivo: str = ""
    registro_id: Optional[str] = None
    creada_por: str = "empleado"

class IncidenciaResolve(BaseModel):
    estatus: str
    admin_comentario: str = ""

@router.post("/incidencias")
def create_incidencia(payload: IncidenciaCreate):
    supabase = get_supabase()
    emp = supabase.table("empleados").select("id").eq("nombre", payload.empleado_nombre).limit(1).execute()
    empleado_id = emp.data[0]["id"] if emp.data else None
    data = {
        "empleado_id": empleado_id,
        "empleado_nombre": payload.empleado_nombre,
        "tipo": payload.tipo,
        "fecha": payload.fecha,
        "hora": payload.hora,
        "motivo": payload.motivo,
        "registro_id": payload.registro_id,
        "creada_por": payload.creada_por,
    }
    result = supabase.table("incidencias").insert(data).execute()
    if result.data:
        return {"ok": True, "id": result.data[0]["id"]}
    raise HTTPException(status_code=400, detail="Error al crear incidencia")

@router.get("/incidencias")
def list_incidencias(estatus: Optional[str] = None, empleado: Optional[str] = None):
    supabase = get_supabase()
    q = supabase.table("incidencias").select("*").order("created_at", desc=True)
    if estatus:
        q = q.eq("estatus", estatus)
    if empleado:
        q = q.eq("empleado_nombre", empleado)
    result = q.execute()
    return result.data or []

@router.get("/incidencias/stats")
def incidencia_stats():
    supabase = get_supabase()
    all_ = supabase.table("incidencias").select("*").execute().data or []
    pendientes = sum(1 for i in all_ if i.get("estatus") == "pendiente")
    aprobadas = sum(1 for i in all_ if i.get("estatus") == "aprobada")
    rechazadas = sum(1 for i in all_ if i.get("estatus") == "rechazada")
    return {"pendientes": pendientes, "aprobadas": aprobadas, "rechazadas": rechazadas, "total": len(all_)}

@router.put("/incidencias/{inc_id}/resolver")
def resolve_incidencia(inc_id: str, payload: IncidenciaResolve):
    supabase = get_supabase()
    supabase.table("incidencias").update({
        "estatus": payload.estatus,
        "admin_comentario": payload.admin_comentario,
        "resuelta_at": datetime.now().isoformat(),
    }).eq("id", inc_id).execute()

    inc = supabase.table("incidencias").select("*").eq("id", inc_id).limit(1).execute()
    if inc.data and payload.estatus == "aprobada":
        reg_id = inc.data[0].get("registro_id")
        if reg_id:
            supabase.table("registros").update({
                "estatus": "Justificado",
                "justificacion": inc.data[0].get("motivo", "")
            }).eq("id", reg_id).execute()

    try:
        from app.api.routes.push import send_push_notification
        send_push_notification(
            inc.data[0]["empleado_nombre"] if inc.data else "Empleado",
            f"Incidencia {payload.estatus}",
            f"Tu incidencia fue {payload.estatus}. {payload.admin_comentario}" if payload.admin_comentario else f"Tu incidencia fue {payload.estatus}"
        )
    except:
        pass

    return {"ok": True}
