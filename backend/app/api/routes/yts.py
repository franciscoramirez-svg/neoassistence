from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import os, re
from datetime import datetime, timezone, date
from app.services.supabase_client import get_supabase

router = APIRouter(tags=["yts"])

_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
YTS_DIR = os.path.join(_BASE, "uploads", "yts")
os.makedirs(YTS_DIR, exist_ok=True)

def parse_mes(mes: str) -> str:
    if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", mes):
        raise HTTPException(status_code=400, detail="Formato de mes inválido. Usar YYYY-MM")
    return mes

@router.get("/yts")
def list_yts():
    """Lista todos los meses que tienen imagen cargada"""
    supabase = get_supabase()
    result = supabase.table("yts_mensual").select("mes, archivo_url, updated_at").order("mes", desc=True).execute()
    return result.data or []

@router.post("/yts/upload")
async def upload_yts(file: UploadFile = File(...), mes: str = Form(...)):
    parse_mes(mes)
    if not file.filename.lower().endswith((".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG/PNG")
    
    ext = os.path.splitext(file.filename)[1]
    filename = f"{mes}{ext}"
    filepath = os.path.join(YTS_DIR, filename)
    
    try:
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar archivo: {str(e)}")
    
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=500, detail=f"El archivo no se guardó en {filepath}")
    
    archivo_url = f"/uploads/yts/{filename}"
    supabase = get_supabase()
    
    try:
        existing = supabase.table("yts_mensual").select("id").eq("mes", mes).execute()
        if existing.data:
            supabase.table("yts_mensual").update({"archivo_url": archivo_url, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("yts_mensual").insert({"mes": mes, "archivo_url": archivo_url}).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {str(e)}")
    
    return {"ok": True, "archivo_url": archivo_url}


class FirmaRequest(BaseModel):
    employee_id: str
    employee_name: str
    condiciones: str = "OK"


@router.post("/yts/firmar")
def firmar_yts(payload: FirmaRequest):
    """Registra la firma diaria del empleado en YTS"""
    supabase = get_supabase()
    today = date.today().isoformat()
    try:
        existing = supabase.table("yts_firmas").select("id").eq("employee_id", payload.employee_id).eq("fecha", today).execute()
        if existing.data:
            return {"ok": True, "message": "Ya firmaste hoy", "ya_firmado": True}
        supabase.table("yts_firmas").insert({
            "employee_id": payload.employee_id,
            "employee_name": payload.employee_name,
            "fecha": today,
            "condiciones": payload.condiciones,
        }).execute()
        return {"ok": True, "message": "Firma registrada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al firmar: {str(e)}")


@router.get("/yts/firma/{employee_id}")
def get_firma_hoy(employee_id: str):
    """Verifica si el empleado ya firmó hoy"""
    supabase = get_supabase()
    today = date.today().isoformat()
    result = supabase.table("yts_firmas").select("*").eq("employee_id", employee_id).eq("fecha", today).execute()
    return {"firmado": len(result.data or []) > 0, "data": result.data[0] if result.data else None}


@router.get("/yts/firmas/{employee_id}")
def get_firmas(employee_id: str):
    """Historial de firmas del empleado"""
    supabase = get_supabase()
    result = supabase.table("yts_firmas").select("*").eq("employee_id", employee_id).order("fecha", desc=True).limit(60).execute()
    return result.data or []
