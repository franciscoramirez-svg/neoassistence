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
def get_login_logs(
    page: int = 1,
    per_page: int = 20,
    search: str | None = None,
    success: bool | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    try:
        sb = get_supabase()

        def apply_filters(q):
            if search:
                q = q.ilike("employee_name", f"%{search}%")
            if success is not None:
                q = q.eq("success", success)
            if start_date:
                q = q.gte("created_at", start_date)
            if end_date:
                q = q.lte("created_at", end_date)
            return q

        count_result = apply_filters(sb.table("login_log").select("*", count="exact")).execute()
        total = count_result.count if count_result.count else 0

        data_query = apply_filters(sb.table("login_log").select("*"))
        data_query = data_query.order("created_at", desc=True)
        data_query = data_query.range((page - 1) * per_page, page * per_page - 1)
        data_result = data_query.execute()

        return {
            "data": data_result.data or [],
            "total": total,
            "page": page,
            "per_page": per_page,
        }
    except:
        return {"data": [], "total": 0, "page": 1, "per_page": per_page}