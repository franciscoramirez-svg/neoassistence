from fastapi import APIRouter
import os

router = APIRouter(tags=["debug"])

@router.get("/debug/test")
def test():
    # Direct hardcoded for testing
    url = "https://mrfpgqewajcaffujkhjk.supabase.co"
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZnBncWV3YWpjYWZmdWpraGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjQ2NjQsImV4cCI6MjA4OTYwMDY2NH0.MUr2ddh3HCATXDYE65Hv8GSlgbHm9vO3_xI6qastago"
    
    return {
        "supabase_url": url,
        "has_key": bool(key),
    }

@router.get("/debug/empleados")
def list_empleados():
    from supabase import create_client
    
    url = "https://mrfpgqewajcaffujkhjk.supabase.co"
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZnBncWV3YWpjYWZmdWpraGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjQ2NjQsImV4cCI6MjA4OTYwMDY2NH0.MUr2ddh3HCATXDYE65Hv8GSlgbHm9vO3_xI6qastago"
    
    client = create_client(url, key)
    result = client.table("empleados").select("id,nombre,activo").execute()
    
    return {"count": len(result.data or []), "empleados": result.data[:10]}

@router.get("/debug/test-login/{name}")
def test_login(name: str):
    from supabase import create_client
    
    url = "https://mrfpgqewajcaffujkhjk.supabase.co"
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZnBncWV3YWpjYWZmdWpraGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjQ2NjQsImV4cCI6MjA4OTYwMDY2NH0.MUr2ddh3HCATXDYE65Hv8GSlgbHm9vO3_xI6qastago"
    
    client = create_client(url, key)
    result = client.table("empleados").select("*").execute()
    
    # Find employee
    emp = None
    for e in result.data:
        if name.lower() in e.get("nombre", "").lower():
            emp = e
            break
    
    if not emp:
        return {"found": False, "available": [e.get("nombre") for e in result.data[:10]]}
    
    return {
        "found": True,
        "nombre": emp.get("nombre"),
        "pin": emp.get("pin"),
        "activo": emp.get("activo"),
        "rol": emp.get("rol"),
    }

@router.get("/debug/empleados")
def list_empleados():
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        
        if not url or not key:
            return {"error": "No credentials"}
        
        client = create_client(url, key)
        result = client.table("empleados").select("id,nombre,activo").execute()
        
        return {"count": len(result.data or []), "empleados": result.data[:5]}
    except Exception as e:
        return {"error": str(e)}

@router.get("/debug/test-login/{name}")
def test_login(name: str):
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        
        if not url or not key:
            return {"error": "No credentials"}
        
        client = create_client(url, key)
        result = client.table("empleados").select("*").execute()
        
        # Find employee by name
        emp = None
        for e in result.data:
            if name.lower() in e.get("nombre", "").lower():
                emp = e
                break
        
        if not emp:
            return {"found": False, "searched": name, "available": [e.get("nombre") for e in result.data[:10]]}
        
        db_pin = emp.get("pin", "NO PIN")
        
        return {
            "found": True,
            "emp_nombre": emp.get("nombre"),
            "db_pin": db_pin,
            "activo": emp.get("activo"),
        }
    except Exception as e:
        return {"error": str(e)}