from datetime import datetime

import pandas as pd

from app.core.rules import calculate_status
from app.services.branches import validate_geofence
from app.services.employees import get_active_employee_by_name
from app.services.supabase_client import get_supabase


def list_records() -> list[dict]:
    result = get_supabase().table("registros").select("*").order("fecha_hora", desc=True).limit(100).execute()
    return result.data or []


def employee_has_recent_duplicate(name: str, movement_type: str, current_dt: datetime, window_minutes: int = 2) -> bool:
    rows = list_records()
    if not rows:
        return False

    frame = pd.DataFrame(rows)
    frame["fecha_hora"] = pd.to_datetime(frame["fecha_hora"], errors="coerce")
    frame = frame.dropna(subset=["fecha_hora"])
    frame = frame[
        (frame["empleado"] == name)
        & (frame["tipo"] == movement_type)
        & (frame["fecha_hora"].dt.date == current_dt.date())
    ]
    if frame.empty:
        return False

    latest = frame.sort_values("fecha_hora").iloc[-1]["fecha_hora"].to_pydatetime()
    delta = abs((current_dt.replace(tzinfo=None) - latest.replace(tzinfo=None)).total_seconds() / 60)
    return delta <= window_minutes


def validate_flow(name: str, movement_type: str) -> tuple[bool, str]:
    rows = list_records()
    if not rows:
        return (movement_type != "Salida"), "No puedes salir sin entrada previa." if movement_type == "Salida" else ""

    frame = pd.DataFrame(rows)
    frame["fecha_hora"] = pd.to_datetime(frame["fecha_hora"], errors="coerce")
    frame = frame.dropna(subset=["fecha_hora"])
    employee_rows = frame[frame["empleado"] == name].sort_values("fecha_hora")
    if employee_rows.empty:
        return (movement_type != "Salida"), "No puedes salir sin entrada previa." if movement_type == "Salida" else ""

    last_type = employee_rows.iloc[-1]["tipo"]
    if movement_type == "Entrada" and last_type == "Entrada":
        return False, "Tienes una entrada sin registrarse salida. Registra salida primero."
    if movement_type == "Salida" and last_type != "Entrada":
        return False, "No puedes salir sin haber tenido una entrada."
    return True, ""


def create_record(payload: dict) -> tuple[bool, str, dict | None]:
    employee = get_active_employee_by_name(payload["employee_name"])
    if not employee:
        return False, "Empleado no encontrado o inactivo.", None

    source = payload.get("source", "")
    now = datetime.now()
    
    # Kiosko: auto-cierra entrada de días anteriores
    if source.startswith("kiosko") and payload["movement_type"] == "Entrada":
        supabase = get_supabase()
        prev = supabase.table("registros").select("*").eq("empleado", payload["employee_name"]).order("fecha_hora", desc=True).limit(1).execute()
        if prev.data:
            last = prev.data[0]
            last_dt = datetime.fromisoformat(last["fecha_hora"].replace("Z", ""))
            if last["tipo"] == "Entrada" and last_dt.date() < now.date():
                close_dt = last_dt.replace(hour=23, minute=59, second=59)
                supabase.table("registros").insert({
                    "empleado": payload["employee_name"],
                    "tipo": "Salida",
                    "fecha_hora": close_dt.isoformat(),
                    "lat": payload.get("lat", 0),
                    "lon": payload.get("lon", 0),
                    "estatus": "A Tiempo",
                    "min_retardo": 0,
                    "sucursal_id": employee.get("sucursal_id"),
                    "justificacion": "Cerrado automático - día anterior",
                }).execute()

    flow_ok, flow_message = validate_flow(payload["employee_name"], payload["movement_type"])
    if not flow_ok:
        return False, flow_message, None

    if employee_has_recent_duplicate(payload["employee_name"], payload["movement_type"], now):
        return False, "Registro duplicado detectado.", None

    # Kiosko bypasses geofence check
    if not source.startswith("kiosko"):
        geofence_ok, geofence_message, distance = validate_geofence(
            payload["lat"],
            payload["lon"],
            str(employee.get("sucursal_id")),
        )
        if not geofence_ok:
            return False, geofence_message, None

    status, delay_minutes = calculate_status(
        payload["movement_type"],
        now,
        employee.get("hora_entrada"),
        employee.get("hora_salida"),
        employee.get("tolerancia_minutos", 15) or 15,
    )

    # En kiosko NO se requiere justificación
    if status != "A Tiempo" and not source.startswith("kiosko"):
        if not payload.get("justification"):
            return False, f"Estatus: {status}. Justificación requerida.", None

    record_payload = {
        "empleado": employee["nombre"],
        "tipo": payload["movement_type"],
        "fecha_hora": now.isoformat(),
        "lat": payload["lat"],
        "lon": payload["lon"],
        "estatus": status,
        "min_retardo": delay_minutes,
        "sucursal_id": employee.get("sucursal_id"),
        "justificacion": payload.get("justification") or "",
    }
    response = get_supabase().table("registros").insert(record_payload).execute()
    created = response.data[0] if response.data else None
    
    # Send push notification
    try:
        from app.api.routes.push import send_push_notification
        mov = payload["movement_type"]
        send_push_notification(
            employee["nombre"],
            f"Registro {mov}",
            f"{mov} registrada a las {now.strftime('%H:%M')} - {status}"
        )
    except:
        pass
    
    return True, "Registro creado correctamente.", created
