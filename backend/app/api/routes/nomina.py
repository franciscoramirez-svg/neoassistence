from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, date, timedelta
from app.services.supabase_client import get_supabase

router = APIRouter(tags=["nomina"])


@router.get("/nomina/calcular")
def calcular_nomina(periodo_inicio: str, periodo_fin: str, empleado: Optional[str] = None):
    supabase = get_supabase()
    emp_query = supabase.table("empleados").select("id,nombre,sueldo_diario")
    if empleado:
        emp_query = emp_query.eq("nombre", empleado)
    empleados = emp_query.execute().data or []

    records = supabase.table("registros").select("*")\
        .gte("fecha_hora", f"{periodo_inicio}T00:00:00")\
        .lte("fecha_hora", f"{periodo_fin}T23:59:59").execute().data or []

    resultado = []
    for emp in empleados:
        recs = [r for r in records if r.get("empleado") == emp["nombre"]]
        por_dia = {}
        for r in recs:
            dia = r["fecha_hora"][:10]
            if dia not in por_dia:
                por_dia[dia] = {"entrada": None, "salida": None}
            if r["tipo"] == "Entrada" and por_dia[dia]["entrada"] is None:
                por_dia[dia]["entrada"] = r
            elif r["tipo"] == "Salida" and por_dia[dia]["salida"] is None:
                por_dia[dia]["salida"] = r

        total_horas = 0.0
        total_retardos_min = 0
        dias_trabajados = 0
        incidencias = 0
        for pair in por_dia.values():
            if pair["entrada"] and pair["salida"]:
                try:
                    h1 = datetime.fromisoformat(pair["entrada"]["fecha_hora"])
                    h2 = datetime.fromisoformat(pair["salida"]["fecha_hora"])
                    total_horas += (h2 - h1).total_seconds() / 3600
                    dias_trabajados += 1
                except:
                    pass
            est = pair["entrada"] and pair["entrada"].get("estatus", "")
            if est and "Retardo" in est:
                total_retardos_min += pair["entrada"].get("min_retardo", 10)
            if pair["entrada"] and pair["entrada"].get("estatus") == "Incidencia":
                incidencias += 1

        sueldo_diario = float(emp.get("sueldo_diario") or 200.0)
        sueldo_bruto = round(dias_trabajados * sueldo_diario, 2)
        descuento_retardos = round((total_retardos_min / 60) * (sueldo_diario / 8), 2)
        descuento_incidencias = incidencias * sueldo_diario * 0.5
        total_descuentos = round(descuento_retardos + descuento_incidencias, 2)
        sueldo_neto = round(sueldo_bruto - total_descuentos, 2)

        resultado.append({
            "empleado": emp["nombre"],
            "dias_trabajados": dias_trabajados,
            "horas_totales": round(total_horas, 1),
            "retardos_min": total_retardos_min,
            "incidencias": incidencias,
            "sueldo_diario": sueldo_diario,
            "sueldo_bruto": sueldo_bruto,
            "descuentos": total_descuentos,
            "sueldo_neto": sueldo_neto,
        })

    return {"periodo": f"{periodo_inicio} a {periodo_fin}", "data": resultado}
