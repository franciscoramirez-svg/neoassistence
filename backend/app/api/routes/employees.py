from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import os
from app.services.employees import list_employees
from app.services.supabase_client import get_supabase

router = APIRouter(tags=["employees"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads", "photos")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class EmployeeCreate(BaseModel):
    nombre: str
    pin: str = "1234"
    rol: str = "employee"
    activo: bool = True
    sucursal_id: Optional[str] = None
    hora_entrada: Optional[str] = None
    hora_salida: Optional[str] = None
    numero_empleado: Optional[str] = None

@router.get("/employees")
def get_employees():
    supabase = get_supabase()
    result = supabase.table("empleados").select("*").order("nombre").execute()
    return result.data or []

@router.post("/employees")
def create_employee(payload: EmployeeCreate):
    supabase = get_supabase()
    data = payload.model_dump()
    if not data.get("sucursal_id"):
        data.pop("sucursal_id", None)
    if not data.get("hora_entrada"):
        data.pop("hora_entrada", None)
    if not data.get("hora_salida"):
        data.pop("hora_salida", None)
    if not data.get("numero_empleado"):
        data.pop("numero_empleado", None)
    
    result = supabase.table("empleados").insert(data).execute()
    if result.data:
        return {"ok": True, "id": result.data[0]["id"]}
    raise HTTPException(status_code=400, detail="Error al crear empleado")

@router.put("/employees/{emp_id}")
def update_employee(emp_id: str, payload: EmployeeCreate):
    supabase = get_supabase()
    data = payload.model_dump(exclude={"id"})
    if not data.get("sucursal_id"):
        data.pop("sucursal_id", None)
    if not data.get("numero_empleado"):
        data.pop("numero_empleado", None)
    
    supabase.table("empleados").update(data).eq("id", emp_id).execute()
    return {"ok": True}

@router.delete("/employees/{emp_id}")
def delete_employee(emp_id: str):
    supabase = get_supabase()
    supabase.table("empleados").delete().eq("id", emp_id).execute()
    return {"ok": True}

class FaceDescriptorRequest(BaseModel):
    face_descriptor: List[float]

@router.put("/employees/{emp_id}/face")
def save_face_descriptor(emp_id: str, payload: FaceDescriptorRequest):
    supabase = get_supabase()
    supabase.table("empleados").update({"face_descriptor": payload.face_descriptor}).eq("id", emp_id).execute()
    return {"ok": True}

@router.get("/employees/faces")
def get_face_descriptors():
    supabase = get_supabase()
    result = supabase.table("empleados").select("id,nombre,pin,face_descriptor").not_.is_("face_descriptor", "null").execute()
    return result.data or []

@router.post("/employees/{emp_id}/photo")
async def upload_photo(emp_id: str, file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{emp_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    foto_url = f"/uploads/photos/{filename}"
    supabase = get_supabase()
    supabase.table("empleados").update({"foto_url": foto_url}).eq("id", emp_id).execute()
    
    return {"ok": True, "foto_url": foto_url}

@router.put("/employees/{emp_id}/badge")
def update_badge(emp_id: str, payload: dict):
    numero = payload.get("numero_empleado")
    if not numero:
        raise HTTPException(status_code=400, detail="numero_empleado required")
    supabase = get_supabase()
    supabase.table("empleados").update({"numero_empleado": numero}).eq("id", emp_id).execute()
    return {"ok": True}
