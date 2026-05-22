from fastapi import APIRouter
from datetime import datetime, date, timedelta
from app.services.supabase_client import get_supabase
from app.core.rules import calculate_status

router = APIRouter(tags=["penalizacion"])

@router.post("/records/auto-close")
def auto_close_open_entries():
    """
    Cierra automáticamente entradas abiertas de días anteriores.
    Para cada empleado con una Entrada sin Salida del día anterior,
    se registra una Salida automática a la hora programada con penalización.
    """
    supabase = get_supabase()
    today = date.today()
    yesterday = today - timedelta(days=1)
    cerrados = 0
    errores = 0

    empleados = supabase.table("empleados").select("id,nombre,hora_entrada,hora_salida,sucursal_id").execute()
    empleados = empleados.data or []

    for emp in empleados:
        ultimo = supabase.table("registros").select("*").eq("empleado", emp["nombre"]).order("fecha_hora", desc=True).limit(1).execute()
        if not ultimo.data:
            continue
        last = ultimo.data[0]
        last_dt = datetime.fromisoformat(last["fecha_hora"].replace("Z", ""))
        if last["tipo"] != "Entrada":
            continue
        if last_dt.date() >= today:
            continue

        hora_salida = emp.get("hora_salida") or "18:00:00"
        try:
            close_dt = last_dt.replace(
                hour=int(hora_salida.split(":")[0]),
                minute=int(hora_salida.split(":")[1]),
                second=int(hora_salida.split(":")[2]) if len(hora_salida.split(":")) > 2 else 0
            )
        except:
            close_dt = last_dt.replace(hour=18, minute=0, second=0)

        status, _ = calculate_status("Salida", close_dt, emp.get("hora_entrada"), hora_salida)

        try:
            supabase.table("registros").insert({
                "empleado": emp["nombre"],
                "tipo": "Salida",
                "fecha_hora": close_dt.isoformat(),
                "lat": 0,
                "lon": 0,
                "estatus": status if status != "A Tiempo" else "OLVIDO REGISTRO",
                "min_retardo": 0,
                "sucursal_id": emp.get("sucursal_id"),
                "justificacion": f"Cierre automático - horario programado {hora_salida}",
            }).execute()
            cerrados += 1
        except:
            errores += 1

    return {"ok": True, "cerrados": cerrados, "errores": errores}
