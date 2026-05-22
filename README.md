# NeoAssistence

Base profesional para control de asistencia con:

- `frontend`: Next.js 15 + TypeScript
- `backend`: FastAPI
- `database`: Supabase

## Objetivo del MVP

- Login con nombre + PIN
- Check-in / check-out
- Justificaciones
- Dashboard administrativo
- Reglas de retardo y geocerca
- Base lista para QR y biometria

## Estructura

```text
neoassistence/
├── backend/
├── frontend/
└── supabase/
```

## Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Variables esperadas

Backend:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_TIMEZONE`
- `DEFAULT_BRANCH_RADIUS_METERS`

Frontend:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Estado actual (28/Abr/2026)

### ✅ IMPLEMENTADO
- Login con nombre + PIN
- Check-in / check-out con GPS
- Kiosko QR con cámara
- Dashboard KPI (entradas, salidas, retardos)
- Mapa Leaflet dark futurista
- Reportes con filtros + exportar CSV
- Geocerca y reglas de retardo

### ⏳ PENDIENTE
- Biometría (reconocimiento facial)
- Auto-reportes programados
- Logo personalizado
- Notificaciones push
- App móvil

---

## Tech Stack

- Frontend: Next.js 15 + TypeScript + Tailwind
- Backend: FastAPI + Pydantic
- Database: Supabase (PostgreSQL)
- Maps: Leaflet
