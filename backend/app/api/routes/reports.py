from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.auto_reports import (
    get_report_config, 
    save_report_config, 
    get_daily_report, 
    run_auto_report,
    ReportConfig
)

router = APIRouter(tags=["reports"])

class ReportConfigRequest(BaseModel):
    email_destino: str = ""
    hora_envio: str = "08:00"
    dias_activos: list[str] = []

@router.get("/reports/config")
def get_config():
    config = get_report_config()
    return {
        "id": config.id,
        "email_destino": config.email_destino,
        "hora_envio": config.hora_envio,
        "dias_activos": config.dias_activos,
        "ultimo_envio": config.ultimo_envio
    }

@router.post("/reports/config")
def update_config(payload: ReportConfigRequest):
    existing = get_report_config()
    config = ReportConfig(
        id="auto_reporte",
        email_destino=payload.email_destino or existing.email_destino,
        hora_envio=payload.hora_envio if payload.hora_envio else "08:00",
        dias_activos=payload.dias_activos if payload.dias_activos else ["lun", "mar", "mie", "jue", "vie"],
        ultimo_envio=existing.ultimo_envio
    )
    success = save_report_config(config)
    if success:
        return {"ok": True, "message": "Configuración guardada"}
    raise HTTPException(status_code=500, detail="Error al guardar configuración")

@router.get("/reports/daily")
def get_today_report():
    return get_daily_report()

@router.post("/reports/send")
def send_report(force: str = "false"):
    if force.lower() == "true":
        from app.services.auto_reports import get_daily_report, send_email_report, get_report_config, save_report_config
        from datetime import datetime
        config = get_report_config()
        if not config.email_destino:
            return {"ok": False, "message": "No hay email configurado"}
        report = get_daily_report()
        success = send_email_report(report, config.email_destino)
        if success:
            config.ultimo_envio = datetime.now().isoformat()
            save_report_config(config)
            return {"ok": True, "message": "Reporte enviado (forzado)", "data": report}
        return {"ok": False, "message": "Error al enviar reporte"}
    return run_auto_report()