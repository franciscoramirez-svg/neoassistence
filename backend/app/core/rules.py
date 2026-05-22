from datetime import datetime, timedelta


def calculate_status(
    movement_type: str,
    current_dt: datetime,
    shift_start: str,
    shift_end: str,
) -> tuple[str, int]:
    delay_minutes = 0
    status = "A Tiempo"
    
    # Handle empty or invalid times
    if not shift_start:
        shift_start = "08:00:00"
    if not shift_end:
        shift_end = "18:00:00"

    start_dt = datetime.combine(current_dt.date(), datetime.strptime(shift_start, "%H:%M:%S").time())
    end_dt = datetime.combine(current_dt.date(), datetime.strptime(shift_end, "%H:%M:%S").time())

    if movement_type == "Entrada":
        diff = (current_dt - start_dt).total_seconds() / 60
        delay_minutes = max(0, int(diff))
        if delay_minutes > 30:
            status = "RETARDO CRITICO"
        elif delay_minutes > 15:
            status = "Retardo"
    elif movement_type == "Salida":
        diff = (end_dt - current_dt).total_seconds() / 60
        if current_dt < end_dt:
            early_minutes = int(diff)
            if early_minutes > 60:
                status = "SALIDA ANTICIPADA"
            elif early_minutes > 30:
                status = "SALIDA TEMPRANA"
        else:
            status = "A Tiempo"

    return status, delay_minutes


def check_missing_salida(employee_id: str, current_date: str) -> dict | None:
    """
    Check if employee has entrada but no salida for the given date.
    Returns a dict with auto-salida data if needed.
    """
    from app.services.supabase_client import get_supabase
    
    supabase = get_supabase()
    
    # Get entries for this employee on the date
    result = supabase.table("registros").select("*").eq("empleado_id", employee_id).gte("fecha_hora", f"{current_date}T00:00:00").lt("fecha_hora", f"{current_date}T23:59:59").execute()
    
    has_entrada = False
    has_salida = False
    
    for r in (result.data or []):
        if r.get("tipo") == "Entrada":
            has_entrada = True
        elif r.get("tipo") == "Salida":
            has_salida = True
    
    # If has entrada but no salida, suggest auto-salida
    if has_entrada and not has_salida:
        return {
            "tipo": "Salida",
            "justificacion": "OLVIDO ESCANEAR SALIDA - Auto registro",
            "estatus": "A Tiempo"
        }
    
    return None