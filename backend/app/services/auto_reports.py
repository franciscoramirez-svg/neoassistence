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
    suc_map = {s["id"]: s["nombre"] for s in (sucursales.data or [])}
    
    items = records.data or []
    
    total = len(items)
    entradas = len([r for r in items if r.get("tipo") == "Entrada"])
    salidas = len([r for r in items if r.get("tipo") == "Salida"])
    retardos = len([r for r in items if r.get("estatus", "").startswith("Retardo")])
    
    por_empleado = {}
    for r in items:
        emp_id = r.get("empleado_id", "")
        nombre = emp_map.get(emp_id, "Desconocido")
        if nombre not in por_empleado:
            por_empleado[nombre] = {"entradas": 0, "salidas": 0, "retardos": 0}
        if r.get("tipo") == "Entrada":
            por_empleado[nombre]["entradas"] += 1
        elif r.get("tipo") == "Salida":
            por_empleado[nombre]["salidas"] += 1
        if r.get("estatus", "").startswith("Retardo"):
            por_empleado[nombre]["retardos"] += 1
    
    por_sucursal = {}
    for r in items:
        suc_id = r.get("sucursal_id", "")
        nombre = suc_map.get(suc_id, "Desconocida")
        if nombre not in por_sucursal:
            por_sucursal[nombre] = {"total": 0, "retardos": 0}
        por_sucursal[nombre]["total"] += 1
        if r.get("estatus", "").startswith("Retardo"):
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

def send_email_report(report: dict, to_email: str) -> bool:
    try:
        if not settings.smtp_user or not settings.smtp_password:
            print(f"[AUTO-REPORTE] SMTP no configurado. Simulando envío a {to_email}")
            return True
        
        msg = MIMEMultipart()
        msg["From"] = settings.email_from or settings.smtp_user
        msg["To"] = to_email
        msg["Subject"] = f"Reporte de Asistencia - {report['fecha']}"
        
        body = f"""
Reporte de Asistencia - {report['fecha']}

Total registros: {report['total']}
Entradas: {report['entradas']}
Salidas: {report['salidas']}
Retardos: {report['retardos']}
A tiempo: {report['a_tiempo']}

-- NeoAssistence
"""
        msg.attach(MIMEText(body, "plain"))
        
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