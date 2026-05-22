from fastapi import APIRouter, HTTPException
from app.schemas.auth import LoginRequest, LoginResponse
from app.services.employees import get_active_employee_by_name

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    employee = get_active_employee_by_name(payload.name)
    
    if not employee:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    
    stored_pin = employee.get("pin")
    if stored_pin and stored_pin != payload.pin:
        raise HTTPException(status_code=401, detail="PIN incorrecto")
    
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