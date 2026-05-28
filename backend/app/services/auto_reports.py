from datetime import datetime, timedelta
from pydantic import BaseModel
from app.services.supabase_client import get_supabase
from app.core.config import settings
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class ReportConfig(BaseModel):
    id: str = "auto_reporte"
    email_destino: str = ""
    hora_envio: str = "08:00"
    dias_activos: list[str] = ["lun", "mar", "mie", "jue", "vie"]
    ultimo_envio: str | None = None

def get_report_config() -> ReportConfig:
    supabase = get_supabase()
    try:
        result = supabase.table("config").select("*").eq("id", "auto_reporte").execute()
        if result.data:
            return ReportConfig(**result.data[0])
    except Exception as e:
        print(f"Error getting config: {e}")
    return ReportConfig()

def save_report_config(config: ReportConfig) -> bool:
    supabase = get_supabase()
    try:
        supabase.table("config").upsert(config.model_dump(), on_conflict="id").execute()
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def get_daily_report(date: str = None) -> dict:
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    
    supabase = get_supabase()
    
    try:
        records = supabase.table("registros").select("*").gte("fecha_hora", f"{date}T00:00:00").lt("fecha_hora", f"{date}T23:59:59").execute()
        empleados = supabase.table("empleados").select("id,nombre").execute()
        sucursales = supabase.table("sucursales").select("id,nombre").execute()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return {"fecha": date, "total": 0, "entradas": 0, "salidas": 0, "retardos": 0, "a_tiempo": 0, "por_empleado": {}, "por_sucursal": {}}
    
    emp_map = {e["id"]: e["nombre"] for e in (empleados.data or [])}
    emp_name_to_id = {e["nombre"]: e["id"] for e in (empleados.data or [])}
    suc_map = {s["id"]: s["nombre"] for s in (sucursales.data or [])}
    
    items = records.data or []
    
    total = len(items)
    entradas = len([r for r in items if r.get("tipo") == "Entrada"])
    salidas = len([r for r in items if r.get("tipo") == "Salida"])
    retardos = len([r for r in items if "retardo" in r.get("estatus", "").lower()])
    
    por_empleado = {}
    for r in items:
        emp_val = r.get("empleado", "") or ""
        if emp_val in emp_name_to_id:
            nombre = emp_val
        else:
            nombre = emp_map.get(emp_val, emp_val or "Desconocido")
        if nombre not in por_empleado:
            por_empleado[nombre] = {"entradas": 0, "salidas": 0, "retardos": 0}
        if r.get("tipo") == "Entrada":
            por_empleado[nombre]["entradas"] += 1
        elif r.get("tipo") == "Salida":
            por_empleado[nombre]["salidas"] += 1
        if "retardo" in r.get("estatus", "").lower():
            por_empleado[nombre]["retardos"] += 1
    
    por_sucursal = {}
    for r in items:
        suc_id = r.get("sucursal_id", "") or ""
        nombre = suc_map.get(suc_id, suc_id if not suc_id else "Desconocida")
        if nombre not in por_sucursal:
            por_sucursal[nombre] = {"total": 0, "retardos": 0}
        por_sucursal[nombre]["total"] += 1
        if "retardo" in r.get("estatus", "").lower():
            por_sucursal[nombre]["retardos"] += 1
    
    return {
        "fecha": date,
        "total": total,
        "entradas": entradas,
        "salidas": salidas,
        "retardos": retardos,
        "a_tiempo": total - retardos,
        "por_empleado": por_empleado,
        "por_sucursal": por_sucursal,
    }

def send_notification_email(to_email: str, subject: str, body_text: str) -> bool:
    try:
        if not settings.smtp_user or not settings.smtp_password:
            print(f"[EMAIL] SMTP no configurado. Simulando envío a {to_email}: {subject}")
            return True
        msg = MIMEText(body_text, "plain")
        msg["From"] = settings.email_from or settings.smtp_user
        msg["To"] = to_email
        msg["Subject"] = subject
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
        server.quit()
        print(f"[EMAIL] Notificación enviada a {to_email}: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL] Error: {e}")
        return False


def send_email_report(report: dict, to_email: str) -> bool:
    try:
        if not settings.smtp_user or not settings.smtp_password:
            print(f"[AUTO-REPORTE] SMTP no configurado. Simulando envío a {to_email}")
            return True

        por_empleado = report.get("por_empleado", {})
        empleados_html = ""
        for nombre, vals in sorted(por_empleado.items()):
            empleados_html += f"<tr><td style='padding:6px 12px;border-bottom:1px solid #eee'>{nombre}</td><td style='padding:6px 12px;border-bottom:1px solid #eee;text-align:center'>{vals.get('entradas',0)}</td><td style='padding:6px 12px;border-bottom:1px solid #eee;text-align:center'>{vals.get('salidas',0)}</td><td style='padding:6px 12px;border-bottom:1px solid #eee;text-align:center;color:#e74c3c'>{vals.get('retardos',0)}</td></tr>"

        por_sucursal = report.get("por_sucursal", {})
        sucursales_html = ""
        for nombre, vals in sorted(por_sucursal.items()):
            sucursales_html += f"<tr><td style='padding:6px 12px;border-bottom:1px solid #eee'>{nombre}</td><td style='padding:6px 12px;border-bottom:1px solid #eee;text-align:center'>{vals.get('total',0)}</td><td style='padding:6px 12px;border-bottom:1px solid #eee;text-align:center;color:#e74c3c'>{vals.get('retardos',0)}</td></tr>"

        html = f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'></head><body style='margin:0;padding:0;background:#f4f6f9;font-family:Segoe UI,sans-serif'>
<table width='100%' cellpadding='0' cellspacing='0'><tr><td align='center' style='padding:30px 15px'>
<table width='600' cellpadding='0' cellspacing='0' style='background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)'>
<tr><td style='background:#0a1526;padding:24px 30px'>
<table width='100%'><tr><td><h1 style='color:#5ef2ff;margin:0;font-size:22px'>NeoAssistence</h1><p style='color:#9bb4ca;margin:4px 0 0;font-size:13px'>Reporte de Asistencia</p></td>
<td align='right'><p style='color:#fff;margin:0;font-size:24px;font-weight:700'>{report['fecha']}</p></td></tr></table>
</td></tr>
<tr><td style='padding:30px'>
<table width='100%' cellpadding='0' cellspacing='0'>
<tr><td style='background:#f0faf0;border-radius:8px;padding:16px;text-align:center;width:25%'><p style='margin:0;font-size:11px;color:#666'>REGISTROS</p><p style='margin:4px 0 0;font-size:28px;font-weight:700;color:#2ecc71'>{report['total']}</p></td>
<td style='width:8px'></td>
<td style='background:#f0faff;border-radius:8px;padding:16px;text-align:center;width:25%'><p style='margin:0;font-size:11px;color:#666'>ENTRADAS</p><p style='margin:4px 0 0;font-size:28px;font-weight:700;color:#3498db'>{report['entradas']}</p></td>
<td style='width:8px'></td>
<td style='background:#f5f0ff;border-radius:8px;padding:16px;text-align:center;width:25%'><p style='margin:0;font-size:11px;color:#666'>SALIDAS</p><p style='margin:4px 0 0;font-size:28px;font-weight:700;color:#9b59b6'>{report['salidas']}</p></td>
<td style='width:8px'></td>
<td style='background:#fef0f0;border-radius:8px;padding:16px;text-align:center;width:25%'><p style='margin:0;font-size:11px;color:#666'>RETARDOS</p><p style='margin:4px 0 0;font-size:28px;font-weight:700;color:#e74c3c'>{report['retardos']}</p></td>
</tr></table>

<h3 style='margin:24px 0 12px;font-size:15px;color:#333'>Por empleado</h3>
<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;font-size:13px'>
<tr style='background:#f8f9fa'><th style='padding:8px 12px;text-align:left;color:#666;font-weight:600'>Empleado</th><th style='padding:8px 12px;text-align:center;color:#666;font-weight:600'>Entradas</th><th style='padding:8px 12px;text-align:center;color:#666;font-weight:600'>Salidas</th><th style='padding:8px 12px;text-align:center;color:#666;font-weight:600'>Retardos</th></tr>
{empleados_html}
</table>

<h3 style='margin:24px 0 12px;font-size:15px;color:#333'>Por sucursal</h3>
<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;font-size:13px'>
<tr style='background:#f8f9fa'><th style='padding:8px 12px;text-align:left;color:#666;font-weight:600'>Sucursal</th><th style='padding:8px 12px;text-align:center;color:#666;font-weight:600'>Total</th><th style='padding:8px 12px;text-align:center;color:#666;font-weight:600'>Retardos</th></tr>
{sucursales_html}
</table>

<p style='margin-top:24px;font-size:12px;color:#999;text-align:center'>Este reporte es generado automáticamente por NeoAssistence.</p>
</td></tr></table>
</td></tr></table>
</body></html>"""

        body_plain = f"Reporte de Asistencia - {report['fecha']}\n\nTotal: {report['total']} | Entradas: {report['entradas']} | Salidas: {report['salidas']} | Retardos: {report['retardos']} | A tiempo: {report['a_tiempo']}\n\n-- NeoAssistence"

        msg = MIMEMultipart("alternative")
        msg["From"] = f"NeoAssistence <{settings.email_from or settings.smtp_user}>"
        msg["To"] = to_email
        msg["Subject"] = f"Reporte de Asistencia - {report['fecha']}"
        msg["Reply-To"] = settings.email_from or settings.smtp_user
        msg.attach(MIMEText(body_plain, "plain"))
        msg.attach(MIMEText(html, "html"))

        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
        server.quit()

        print(f"[AUTO-REPORTE] Email enviado a {to_email}")
        return True
    except Exception as e:
        print(f"[AUTO-REPORTE] Error al enviar email: {e}")
        return False

def should_send_today(config: ReportConfig) -> bool:
    now = datetime.now()
    dia_map = {"lun": 0, "mar": 1, "mie": 2, "jue": 3, "vie": 4, "sab": 5, "dom": 6}
    
    if now.weekday() not in [dia_map.get(d, -1) for d in config.dias_activos]:
        return False
    
    if config.ultimo_envio:
        ultimo = datetime.fromisoformat(config.ultimo_envio)
        if ultimo.date() == now.date():
            return False
    
    hora_envio = datetime.strptime(config.hora_envio, "%H:%M").time()
    if now.time() < hora_envio:
        return False
    
    return True

def run_auto_report() -> dict:
    config = get_report_config()
    
    if not config.email_destino:
        return {"ok": False, "message": "No hay email configurado"}
    
    if not should_send_today(config):
        return {"ok": False, "message": "No hay envío programado para hoy"}
    
    report = get_daily_report()
    success = send_email_report(report, config.email_destino)
    
    if success:
        config.ultimo_envio = datetime.now().isoformat()
        save_report_config(config)
        return {"ok": True, "message": "Reporte enviado", "data": report}
    
    return {"ok": False, "message": "Error al enviar reporte"}