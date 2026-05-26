from datetime import datetime, timezone, timedelta
import pandas as pd

from app.core.rules import calculate_status
from app.services.branches import validate_geofence
from app.services.employees import get_active_employee_by_name
from app.services.supabase_client import get_supabase

try:
    from zoneinfo import ZoneInfo
    MEXICO_TZ = ZoneInfo("America/Mexico_City")
except (ImportError, KeyError, Exception):
    MEXICO_TZ = timezone(timedelta(hours=-6))


def _ensure_tz(fh: str) -> str:
    if not fh:
        return fh
    if fh[-1] == "Z":
        return fh
    if len(fh) >= 6 and fh[-6] in ("+", "-") and fh[-3] == ":":
        return fh
    return fh + "Z"

def list_records() -> list[dict]:
    result = get_supabase().table("registros").select("*").order("fecha_hora", desc=True).limit(100).execute()
    rows = result.data or []
    for r in rows:
        r["fecha_hora"] = _ensure_tz(r.get("fecha_hora", ""))
    return rows


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
    # Compare both in UTC to avoid timezone mismatch
    current_utc = current_dt.astimezone(timezone.utc).replace(tzinfo=None)
    latest_utc = latest.replace(tzinfo=None)
    delta = abs((current_utc - latest_utc).total_seconds() / 60)
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
    now_mx = datetime.now(MEXICO_TZ)
    today = now_mx.strftime("%Y-%m-%d")

    # Verifica si el empleado tiene un permiso aprobado para hoy
    tiene_permiso = False
    try:
        permisos = get_supabase().table("permisos").select("*")\
            .eq("empleado_nombre", payload["employee_name"])\
            .eq("estatus", "aprobado")\
            .lte("fecha_inicio", today)\
            .gte("fecha_fin", today)\
            .execute()
        if permisos.data:
            tiene_permiso = True
    except:
        pass

    # Kiosko: auto-cierra entrada de días anteriores
    if source.startswith("kiosko") and payload["movement_type"] == "Entrada":
        supabase = get_supabase()
        prev = supabase.table("registros").select("*").eq("empleado", payload["employee_name"]).order("fecha_hora", desc=True).limit(1).execute()
        if prev.data:
            last = prev.data[0]
            try:
                last_dt = datetime.fromisoformat(last["fecha_hora"])
            except:
                last_dt = datetime.fromisoformat(last["fecha_hora"].replace("Z", ""))
            if last_dt.tzinfo:
                last_dt = last_dt.replace(tzinfo=None)
            if last["tipo"] == "Entrada" and last_dt.date() < now_mx.date():
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

    if employee_has_recent_duplicate(payload["employee_name"], payload["movement_type"], now_mx):
        return False, "Registro duplicado detectado.", None

    # Kiosko, QR y permiso aprobado bypass geofence check
    if not source.startswith("kiosko") and source != "qr" and not tiene_permiso:
        geofence_ok, geofence_message, distance = validate_geofence(
            payload["lat"],
            payload["lon"],
            str(employee.get("sucursal_id")),
        )
        if not geofence_ok:
            return False, geofence_message, None

    if tiene_permiso:
        status = "Permiso"
        delay_minutes = 0
        justificacion = "Permiso aprobado"
    else:
        status, delay_minutes = calculate_status(
            payload["movement_type"],
            now_mx.replace(tzinfo=None),
            employee.get("hora_entrada"),
            employee.get("hora_salida"),
            employee.get("tolerancia_minutos", 15) or 15,
        )
        justificacion = payload.get("justification") or ""

    # En kiosko o permiso NO se requiere justificación
    if status not in ("A Tiempo", "Permiso") and not source.startswith("kiosko"):
        if not payload.get("justification"):
            return False, f"Estatus: {status}. Justificación requerida.", None

    now_utc = now_mx.astimezone(timezone.utc).replace(tzinfo=None)
    sucursal_id = payload.get("branch_id") or employee.get("sucursal_id")
    record_payload = {
        "empleado": employee["nombre"],
        "tipo": payload["movement_type"],
        "fecha_hora": now_utc.isoformat(),
        "lat": payload["lat"],
        "lon": payload["lon"],
        "estatus": status,
        "min_retardo": delay_minutes,
        "sucursal_id": sucursal_id,
        "justificacion": justificacion,
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
            f"{mov} registrada a las {now_mx.strftime('%H:%M')} - {status}"
        )
    except:
        pass
    
    return True, "Registro creado correctamente.", created
