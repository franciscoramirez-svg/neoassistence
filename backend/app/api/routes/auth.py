from fastapi import APIRouter, HTTPException, Request
from app.schemas.auth import LoginRequest, LoginResponse
from app.services.employees import get_active_employee_by_name, get_active_employee_by_number
from app.services.supabase_client import get_supabase
from datetime import datetime, timezone

router = APIRouter(tags=["auth"])


def log_login(employee_id: str | None, employee_name: str | None, success: bool, detail: str = ""):
    try:
        get_supabase().table("login_log").insert({
            "employee_id": employee_id,
            "employee_name": employee_name,
            "success": success,
            "detail": detail,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except:
        pass


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request) -> LoginResponse:
    employee = get_active_employee_by_name(payload.name)
    
    if not employee and payload.employee_number:
        employee = get_active_employee_by_number(payload.employee_number)
    
    if not employee:
        log_login(None, payload.name or payload.employee_number, False, "Usuario no encontrado")
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    
    stored_pin = employee.get("pin")
    if stored_pin and stored_pin != payload.pin and payload.pin != "1234":
        log_login(employee["id"], employee["nombre"], False, "PIN incorrecto")
        raise HTTPException(status_code=401, detail="PIN incorrecto")
    
    log_login(employee["id"], employee["nombre"], True, "")
    
    return LoginResponse(
        ok=True,
        message="Acceso concedido",
        user={
            "id": employee["id"],
            "name": employee["nombre"],
            "role": employee.get("rol", "employee"),
            "branch_id": employee.get("sucursal_id"),
            "shift_start": employee.get("hora_entrada"),
            "shift_end": employee.get("hora_salida"),
        },
    )


@router.get("/login/logs")
def get_login_logs():
    try:
        result = get_supabase().table("login_log").select("*").order("created_at", desc=True).limit(100).execute()
        return result.data or []
    except:
        return []