from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import io
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


@router.get("/records/calendar")
def calendar_data(mes: str, empleado: Optional[str] = None):
    supabase = get_supabase()
    q = supabase.table("registros").select("*").gte("fecha_hora", f"{mes}-01").lte("fecha_hora", f"{mes}-31").execute()
    rows = q.data or []
    days: dict[str, list[str]] = {}
    for r in rows:
        d = r.get("fecha_hora", "")[:10]
        if not d:
            continue
        if empleado and r.get("empleado") != empleado:
            continue
        if d not in days:
            days[d] = []
        days[d].append(r.get("estatus", ""))
    result = {}
    for d, statuses in days.items():
        if any("Retardo" in s for s in statuses):
            result[d] = "retardo"
        elif any(s == "Permiso" for s in statuses):
            result[d] = "permiso"
        elif any(s in ("A Tiempo", "OLVIDO REGISTRO", "Justificado") for s in statuses):
            result[d] = "presente"
        else:
            result[d] = "otro"
    return result


@router.put("/admin/records/{record_id}")
def update_record(record_id: str, payload: dict):
    supabase = get_supabase()
    allowed = {}
    if "estatus" in payload:
        allowed["estatus"] = payload["estatus"]
    if "justificacion" in payload:
        allowed["justificacion"] = payload["justificacion"]
    if not allowed:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = supabase.table("registros").update(allowed).eq("id", record_id).execute()
    if result.data:
        return {"ok": True, "data": result.data[0]}
    raise HTTPException(status_code=404, detail="Record not found")


@router.get("/records/export/excel")
def export_excel(fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None, sucursal_id: Optional[str] = None):
    from openpyxl import Workbook
    supabase = get_supabase()
    q = supabase.table("registros").select("*").order("fecha_hora", desc=True).limit(5000).execute()
    rows = q.data or []

    wb = Workbook()
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
