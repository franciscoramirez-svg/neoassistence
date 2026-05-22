from app.core.config import settings
import requests

url = settings.supabase_url + '/rest/v1/empleados'
headers = {
    'apikey': settings.supabase_service_role_key,
    'Authorization': 'Bearer ' + settings.supabase_service_role_key
}

resp = requests.get(url + '?select=nombre,rol,activo', headers=headers)
for emp in resp.json():
    if emp.get('activo'):
        print(f"{emp.get('nombre'):<30} - {emp.get('rol', 'empleado')}")