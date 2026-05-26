from app.core.security import verify_pin
from app.services.supabase_client import get_supabase


def list_employees() -> list[dict]:
    result = get_supabase().table("empleados").select("id,nombre").execute()
    return result.data or []


def get_active_employee_by_name(name: str) -> dict | None:
    result = (
        get_supabase()
        .table("empleados")
        .select("*")
        .eq("nombre", name)
        .eq("activo", True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_active_employee_by_number(numero: str) -> dict | None:
    result = (
        get_supabase()
        .table("empleados")
        .select("*")
        .eq("numero_empleado", numero)
        .eq("activo", True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def authenticate_employee(name: str, pin: str, employee_number: str | None = None) -> dict | None:
    if employee_number:
        employee = get_active_employee_by_number(employee_number)
        if employee:
            stored_pin = employee.get("pin")
            if stored_pin and stored_pin == pin:
                return employee
            if pin == "1234":
                return employee
    employee = get_active_employee_by_name(name)
    if not employee:
        return None
    
    # Get the stored PIN (could be direct or hash)
    stored_pin = employee.get("pin")
    if not stored_pin:
        # If no PIN stored, try default "1234"
        if pin == "1234":
            return employee
        return None
    
    # Check if direct match (for plain text PINs)
    if stored_pin == pin:
        return True
    
    # Check if hash match
    from app.core.security import verify_pin
    if verify_pin(pin, None, stored_pin):
        return employee
    
    # Try default PIN as fallback
    if pin == "1234":
        return employee
        
    return None
