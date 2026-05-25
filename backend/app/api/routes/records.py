from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import io, openpyxl
from datetime import datetime

from app.schemas.records import ApiMessage, RecordCreateRequest
from app.services.records import create_record, list_records
from app.services.supabase_client import get_supabase


router = APIRouter(tags=["records"])


@router.get("/records", response_model=ApiMessage)
def get_records() -> ApiMessage:
    return ApiMessage(ok=True, message="ok", data={"items": list_records()})


@router.post("/records", response_model=ApiMessage)
def post_record(payload: RecordCreateRequest) -> ApiMessage:
    ok, message, data = create_record(payload.model_dump())
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return ApiMessage(ok=True, message=message, data=data)


@router.get("/records/export/excel")
def export_excel(fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None, sucursal_id: Optional[str] = None):
    supabase = get_supabase()
    q = supabase.table("registros").select("*").order("fecha_hora", desc=True).limit(5000).execute()
    rows = q.data or []

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Asistencia"
    ws.append(["Fecha/Hora", "Empleado", "Tipo", "Estatus", "Min Retardo", "Sucursal", "Justificación"])

    for r in rows:
        fh = r.get("fecha_hora", "")
        if fecha_inicio and fh < fecha_inicio:
            continue
        if fecha_fin and fh > fecha_fin + "T23:59:59":
            continue
        if sucursal_id and str(r.get("sucursal_id", "")) != sucursal_id:
            continue
        ws.append([
            fh,
            r.get("empleado", ""),
            r.get("tipo", ""),
            r.get("estatus", ""),
            r.get("min_retardo", 0),
            str(r.get("sucursal_id", "")),
            r.get("justificacion", ""),
        ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"asistencia_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"})
