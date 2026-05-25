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


@router.get("/records/export/semanal")
def export_semanal(fecha_inicio: str, fecha_fin: str):
    from openpyxl import Workbook
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from collections import defaultdict
    supabase = get_supabase()

    records = (supabase.table("registros").select("*")
        .gte("fecha_hora", f"{fecha_inicio}T00:00:00")
        .lte("fecha_hora", f"{fecha_fin}T23:59:59")
        .execute().data or [])

    empleados = supabase.table("empleados").select("nombre").execute().data or []
    todos_empleados = [e["nombre"] for e in empleados]

    from datetime import date as date_type, timedelta
    inicio = date_type.fromisoformat(fecha_inicio)
    fin = date_type.fromisoformat(fecha_fin)
    dias = []
    d = inicio
    while d <= fin:
        dias.append(d)
        d += timedelta(days=1)

    dias_semana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

    emp_diario = defaultdict(lambda: defaultdict(list))
    for r in records:
        try:
            dia = r["fecha_hora"][:10]
        except:
            continue
        emp_diario[r.get("empleado", "")][dia].append(r)

    wb = Workbook()
    ws = wb.active
    ws.title = "Resumen Semanal"

    header_fill = PatternFill(start_color="1a3a5c", end_color="1a3a5c", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    thin_border = Border(
        left=Side(style="thin", color="335577"),
        right=Side(style="thin", color="335577"),
        top=Side(style="thin", color="335577"),
        bottom=Side(style="thin", color="335577"),
    )
    center_align = Alignment(horizontal="center", vertical="center")

    headers = ["No.", "Empleado", "Días Trab."]
    for d_idx, dia in enumerate(dias):
        headers.append(dias_semana[d_idx])
    headers += ["Retardos", "Min Retardo", "Faltas", "Horas Extra"]

    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align
        cell.border = thin_border

    verde = PatternFill(start_color="9cffb5", end_color="9cffb5", fill_type="solid")
    rojo = PatternFill(start_color="ff8c9e", end_color="ff8c9e", fill_type="solid")
    gris = PatternFill(start_color="334466", end_color="334466", fill_type="solid")
    naranja = PatternFill(start_color="ffcc5e", end_color="ffcc5e", fill_type="solid")

    for idx, emp_name in enumerate(todos_empleados, 1):
        row_data = [idx, emp_name, 0]
        trabajados = 0
        total_retardos = 0
        total_ret_min = 0
        faltas = 0

        for dia in dias:
            key = dia.isoformat()
            day_recs = emp_diario.get(emp_name, {}).get(key, [])
            if not day_recs:
                if dia.weekday() < 5:
                    row_data.append("❌")
                    faltas += 1
                else:
                    row_data.append("-")
                continue
            estatuses = [r.get("estatus", "") for r in day_recs if r.get("tipo") == "Entrada"]
            if any("Retardo" in s for s in estatuses):
                row_data.append("⚠️")
                trabajados += 1
                total_retardos += 1
                ret_min = sum(r.get("min_retardo", 0) for r in day_recs if "Retardo" in r.get("estatus", ""))
                total_ret_min += ret_min
            elif any(s in ("A Tiempo", "Permiso", "OLVIDO REGISTRO") for s in estatuses):
                row_data.append("✅")
                trabajados += 1
            else:
                row_data.append("✅")
                trabajados += 1 if day_recs else 0

        row_data[2] = trabajados
        row_data += [total_retardos, total_ret_min, faltas, ""]

        ws.append(row_data)
        for col_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=idx + 1, column=col_idx)
            cell.alignment = center_align
            cell.border = thin_border
            if col_idx <= 2:
                cell.font = Font(color="FFFFFF")
            val = str(cell.value or "")
            if val == "✅" and col_idx >= 4 and col_idx < 4 + len(dias):
                cell.fill = verde
                cell.font = Font(size=14)
            elif val == "⚠️":
                cell.fill = rojo
                cell.font = Font(size=14)
            elif val == "❌":
                cell.fill = naranja
                cell.font = Font(size=14, color="000000")

    from openpyxl.utils import get_column_letter
    for col_num in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(col_num)].width = 16
    ws.column_dimensions["B"].width = 28

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"reporte_semanal_{fecha_inicio}_{fecha_fin}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
