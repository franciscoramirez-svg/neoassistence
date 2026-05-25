from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os, asyncio

from app.api.routes import auth, health, records, branches, employees
from app.api.routes import reports, notifications
from app.api.routes import debug, yts, penalizacion, push
from app.api.routes import incidencias, permisos, nomina, analytics
from app.core.config import settings


async def auto_close_loop():
    """Ejecuta auto-close y alertas de retardos cada 60 minutos"""
    while True:
        try:
            from app.api.routes.penalizacion import auto_close_open_entries
            result = auto_close_open_entries()
            print(f"[CRON] Auto-close: {result.get('cerrados', 0)} cerrados, {result.get('errores', 0)} errores")
        except Exception as e:
            print(f"[CRON] Auto-close error: {e}")
        try:
            from app.api.routes.analytics import check_retardo_thresholds
            alert_result = check_retardo_thresholds()
            if alert_result["alertas"] > 0:
                print(f"[CRON] Alertas enviadas: {alert_result['alertas']}")
        except Exception as e:
            print(f"[CRON] Alerta error: {e}")
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(auto_close_loop())
    yield
    task.cancel()


app = FastAPI(
    title="NeoAssistence API",
    version="0.1.0",
    description="API profesional para asistencia, geocerca y operaciones multi-sucursal.",
    lifespan=lifespan,
)


@app.middleware("http")
async def add_cors(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Expose-Headers"] = "*"
    return response


@app.options("/{rest:path}")
async def preflight():
    return JSONResponse(content="")

uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(os.path.join(uploads_dir, "photos"), exist_ok=True)
os.makedirs(os.path.join(uploads_dir, "yts"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(records.router, prefix="/api")
app.include_router(branches.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(debug.router, prefix="/api")
app.include_router(yts.router, prefix="/api")
app.include_router(penalizacion.router, prefix="/api")
app.include_router(push.router, prefix="/api")
app.include_router(incidencias.router, prefix="/api")
app.include_router(permisos.router, prefix="/api")
app.include_router(nomina.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")


@app.get("/")
def root() -> dict:
    return {"name": "NeoAssistence API", "status": "ok"}
