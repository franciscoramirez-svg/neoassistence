from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, date, timedelta
import io, calendar
from collections import defaultdict
from app.services.supabase_client import get_supabase

router = APIRouter(tags=["analytics"])

MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

def _get_records(supabase, desde: str, hasta: str):
    return (supabase.table("registros").select("*")
        .gte("fecha_hora", f"{desde}T00:00:00")
        .lte("fecha_hora", f"{hasta}T23:59:59")
        .execute().data or [])

def _get_empleados(supabase):
    return supabase.table("empleados").select("id,nombre,sucursal_id").execute().data or []


@router.get("/analytics/ranking")
def ranking_puntualidad(periodo_inicio: Optional[str] = None, periodo_fin: Optional[str] = None):
    supabase = get_supabase()
    hoy = date.today()
    if not periodo_inicio:
        periodo_inicio = hoy.replace(day=1).isoformat()
    if not periodo_fin:
        periodo_fin = hoy.isoformat()

    records = _get_records(supabase, periodo_inicio, periodo_fin)
    emp_map = {e["nombre"]: e for e in _get_empleados(supabase)}

    emp_stats = defaultdict(lambda: {"total": 0, "retardos": 0, "retardo_min": 0, "a_tiempo": 0})
    for r in records:
        name = r.get("empleado", "")
        if not name:
            continue
        emp_stats[name]["total"] += 1
        est = r.get("estatus", "")
        if "retardo" in est.lower():
            emp_stats[name]["retardos"] += 1
            emp_stats[name]["retardo_min"] += r.get("min_retardo", 0)
        elif est == "A Tiempo":
            emp_stats[name]["a_tiempo"] += 1

    ranking = []
    for name, stats in emp_stats.items():
        pct = round(((stats["total"] - stats["retardos"]) / stats["total"]) * 100, 1) if stats["total"] > 0 else 0
        emp = emp_map.get(name, {})
        ranking.append({
            "empleado": name,
            "empleado_id": emp.get("id"),
            "total_registros": stats["total"],
            "a_tiempo": stats["a_tiempo"],
            "retardos": stats["retardos"],
            "retardo_minutos": stats["retardo_min"],
            "puntualidad_pct": pct,
        })

    ranking.sort(key=lambda x: (x["puntualidad_pct"], -x["retardos"]), reverse=True)
    for i, item in enumerate(ranking, 1):
        item["posicion"] = i

    return {
        "periodo": f"{periodo_inicio} a {periodo_fin}",
        "total_empleados": len(ranking),
        "data": ranking,
    }


@router.get("/analytics/retardos-mensuales")
def retardos_mensuales(anio: Optional[int] = None):
    if not anio:
        anio = date.today().year
    supabase = get_supabase()

    records = (supabase.table("registros").select("*")
        .gte("fecha_hora", f"{anio}-01-01T00:00:00")
        .lte("fecha_hora", f"{anio}-12-31T23:59:59")
        .execute().data or [])

    meses = defaultdict(lambda: {"total": 0, "retardos": 0})
    for r in records:
        try:
            mes = int(r["fecha_hora"][5:7])
        except:
            continue
        meses[mes]["total"] += 1
        if "retardo" in (r.get("estatus", "")).lower():
            meses[mes]["retardos"] += 1

    result = []
    for m in range(1, 13):
        s = meses[m]
        pct = round((s["retardos"] / s["total"]) * 100, 1) if s["total"] > 0 else 0
        result.append({
            "mes": m,
            "mes_label": MONTHS_ES[m - 1],
            "total": s["total"],
            "retardos": s["retardos"],
            "porcentaje_retardo": pct,
        })

    return {"anio": anio, "data": result}


@router.get("/analytics/tendencias")
def tendencias(meses: Optional[int] = 6):
    supabase = get_supabase()
    hoy = date.today()
    desde = hoy - timedelta(days=meses * 31)

    records = _get_records(supabase, desde.isoformat(), hoy.isoformat())

    meses_data = defaultdict(lambda: {"total": 0, "entradas": 0, "salidas": 0, "a_tiempo": 0, "retardos": 0, "permisos": 0})
    for r in records:
        try:
            key = r["fecha_hora"][:7]
        except:
            continue
        meses_data[key]["total"] += 1
        if r.get("tipo") == "Entrada":
            meses_data[key]["entradas"] += 1
        else:
            meses_data[key]["salidas"] += 1
        est = r.get("estatus", "")
        if "retardo" in est.lower():
            meses_data[key]["retardos"] += 1
        elif est == "A Tiempo":
            meses_data[key]["a_tiempo"] += 1
        elif est == "Permiso":
            meses_data[key]["permisos"] += 1

    result = []
    for key in sorted(meses_data.keys()):
        s = meses_data[key]
        pct_ret = round((s["retardos"] / s["total"]) * 100, 1) if s["total"] > 0 else 0
        result.append({
            "mes": key,
            "total": s["total"],
            "entradas": s["entradas"],
            "salidas": s["salidas"],
            "a_tiempo": s["a_tiempo"],
            "retardos": s["retardos"],
            "permisos": s["permisos"],
            "porcentaje_retardo": pct_ret,
        })

    return {"data": result}


@router.get("/analytics/sucursales")
def sucursales_stats(periodo_inicio: Optional[str] = None, periodo_fin: Optional[str] = None):
    supabase = get_supabase()
    hoy = date.today()
    if not periodo_inicio:
        periodo_inicio = (hoy - timedelta(days=6)).isoformat()
    if not periodo_fin:
        periodo_fin = hoy.isoformat()

    branches = supabase.table("sucursales").select("id,nombre").execute().data or []
    records = _get_records(supabase, periodo_inicio, periodo_fin)

    branch_map = {b["id"]: b["nombre"] for b in branches}
    fechas_7 = [(hoy - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]

    branch_stats = {}
    for b in branches:
        bid = b["id"]
        recs = [r for r in records if r.get("sucursal_id") == bid or str(r.get("sucursal_id", "")) == bid]
        trend = []
        for fd in fechas_7:
            day_recs = [r for r in recs if r.get("fecha_hora", "").startswith(fd)]
            trend.append({
                "fecha": fd,
                "total": len(day_recs),
                "entradas": sum(1 for r in day_recs if r["tipo"] == "Entrada"),
                "salidas": sum(1 for r in day_recs if r["tipo"] == "Salida"),
                "retardos": sum(1 for r in day_recs if "retardo" in (r.get("estatus", "")).lower()),
            })

        total_entradas = sum(t["entradas"] for t in trend)
        total_salidas = sum(t["salidas"] for t in trend)
        total_retardos = sum(t["retardos"] for t in trend)
        total_registros = sum(t["total"] for t in trend)

        branch_stats[bid] = {
            "sucursal_id": bid,
            "nombre": b["nombre"],
            "total_registros": total_registros,
            "entradas": total_entradas,
            "salidas": total_salidas,
            "retardos": total_retardos,
            "trend": trend,
        }

    return {"periodo": f"{periodo_inicio} a {periodo_fin}", "data": list(branch_stats.values())}


@router.get("/analytics/historial-puntualidad")
def historial_puntualidad(empleado: str, meses: Optional[int] = 12):
    supabase = get_supabase()
    hoy = date.today()
    desde = hoy - timedelta(days=meses * 31)

    records = (supabase.table("registros").select("*")
        .eq("empleado", empleado)
        .gte("fecha_hora", f"{desde}T00:00:00")
        .lte("fecha_hora", f"{hoy}T23:59:59")
        .execute().data or [])

    meses_data = defaultdict(lambda: {"total": 0, "retardos": 0, "a_tiempo": 0, "permisos": 0})
    for r in records:
        try:
            key = r["fecha_hora"][:7]
        except:
            continue
        meses_data[key]["total"] += 1
        est = r.get("estatus", "")
        if "retardo" in est.lower():
            meses_data[key]["retardos"] += 1
        elif est == "A Tiempo":
            meses_data[key]["a_tiempo"] += 1
        elif est == "Permiso":
            meses_data[key]["permisos"] += 1

    result = []
    for key in sorted(meses_data.keys()):
        s = meses_data[key]
        pct = round(((s["total"] - s["retardos"]) / s["total"]) * 100, 1) if s["total"] > 0 else 0
        result.append({
            "mes": key,
            "total_registros": s["total"],
            "a_tiempo": s["a_tiempo"],
            "retardos": s["retardos"],
            "permisos": s["permisos"],
            "puntualidad_pct": pct,
        })

    return {"empleado": empleado, "data": result}


@router.get("/analytics/ranking/export/excel")
def export_ranking_excel(periodo_inicio: Optional[str] = None, periodo_fin: Optional[str] = None):
    from openpyxl import Workbook
    data = ranking_puntualidad(periodo_inicio, periodo_fin)
    ranking = data["data"]

    wb = Workbook()
    ws = wb.active
    ws.title = "Ranking Puntualidad"
    ws.append(["#", "Empleado", "Total Registros", "A Tiempo", "Retardos", "Min Retardo", "% Puntualidad"])

    for r in ranking:
        ws.append([
            r["posicion"],
            r["empleado"],
            r["total_registros"],
            r["a_tiempo"],
            r["retardos"],
            r["retardo_minutos"],
            f'{r["puntualidad_pct"]}%',
        ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"ranking_puntualidad_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def check_retardo_thresholds():
    """Background task: alerta si empleado tiene 3+ retardos en la última semana"""
    supabase = get_supabase()
    hoy = date.today()
    semana_atras = (hoy - timedelta(days=7)).isoformat()

    records = _get_records(supabase, semana_atras, hoy.isoformat())

    emp_retardos = defaultdict(int)
    for r in records:
        if "retardo" in (r.get("estatus", "")).lower():
            emp_retardos[r.get("empleado", "")] += 1

    for emp_name, count in emp_retardos.items():
        if count >= 3:
            try:
                from app.api.routes.push import send_push_notification
                send_push_notification(
                    emp_name,
                    f"Alerta: {count} retardos",
                    f"{emp_name} tiene {count} retardos en la última semana."
                )
            except:
                pass

    return {"checked": True, "alertas": sum(1 for c in emp_retardos.values() if c >= 3)}
