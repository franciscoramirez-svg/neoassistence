from fastapi import APIRouter
from datetime import datetime, date
from zoneinfo import ZoneInfo
from app.services.supabase_client import get_supabase
from app.core.rules import calculate_status

MEXICO_TZ = ZoneInfo("America/Mexico_City")

router = APIRouter(tags=["penalizacion"])

@router.post("/records/auto-close")
def auto_close_open_entries():
    """
    Cierra automáticamente entradas abiertas de días anteriores.
    Para cada empleado con una Entrada sin Salida del día anterior,
    se registra una Salida automática al final del día con estatus OLVIDO REGISTRO.
    Solo corre UNA VEZ por entrada abierta (dedup por justificacion).
    """
    supabase = get_supabase()
    today = datetime.now(MEXICO_TZ).date()
    cerrados = 0
    errores = 0
    saltados = 0

    empleados = supabase.table("empleados").select("id,nombre,hora_entrada,hora_salida,sucursal_id").execute()
    empleados = empleados.data or []

    for emp in empleados:
        ultimo = supabase.table("registros").select("*").eq("empleado", emp["nombre"]).order("fecha_hora", desc=True).limit(1).execute()
        if not ultimo.data:
            continue
        last = ultimo.data[0]
        try:
            last_dt = datetime.fromisoformat(last["fecha_hora"])
        except:
            last_dt = datetime.fromisoformat(last["fecha_hora"].replace("Z", ""))
        if last_dt.tzinfo:
            last_dt = last_dt.replace(tzinfo=None)
        if last["tipo"] != "Entrada":
            continue
        if last_dt.date() >= today:
            continue

        # Saltar fin de semana
        if last_dt.weekday() >= 5:
            saltados += 1
            continue

        entry_date = last_dt.strftime("%Y-%m-%d")
        # Saltar si ya se auto-cerró esta entrada
        ya_cerrado = supabase.table("registros").select("id")\
            .eq("empleado", emp["nombre"])\
            .gte("fecha_hora", f"{entry_date}T18:00:00")\
            .like("justificacion", "%Cierre automático%")\
            .limit(1).execute()
        if ya_cerrado.data:
            saltados += 1
            continue

        # Saltar si el empleado tiene permiso aprobado
        permiso = supabase.table("permisos").select("*")\
            .eq("empleado_nombre", emp["nombre"])\
            .eq("estatus", "aprobado")\
            .lte("fecha_inicio", entry_date)\
            .gte("fecha_fin", entry_date)\
            .execute()
        if permiso.data:
            continue

        # Cerrar al final del día (23:59:59) para evitar loop si hora_salida < hora_entrada
        close_dt = last_dt.replace(hour=23, minute=59, second=59)
        hora_salida = emp.get("hora_salida") or "18:00:00"

        try:
            supabase.table("registros").insert({
                "empleado": emp["nombre"],
                "tipo": "Salida",
                "fecha_hora": close_dt.isoformat(),
                "lat": 0,
                "lon": 0,
                "estatus": "OLVIDO REGISTRO",
                "min_retardo": 0,
                "sucursal_id": emp.get("sucursal_id"),
                "justificacion": f"Cierre automático - horario programado {hora_salida}",
            }).execute()
            cerrados += 1
        except:
            errores += 1

    return {"ok": True, "cerrados": cerrados, "errores": errores, "saltados": saltados}
