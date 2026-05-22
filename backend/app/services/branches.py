from app.core.config import settings
from app.core.geo import haversine_distance_meters
from app.services.supabase_client import get_supabase


def list_branches() -> list[dict]:
    result = get_supabase().table("sucursales").select("*").execute()
    return result.data or []


def get_branch(branch_id: str) -> dict | None:
    result = (
        get_supabase()
        .table("sucursales")
        .select("*")
        .eq("id", branch_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def validate_geofence(lat: float, lon: float, branch_id: str) -> tuple[bool, str, float]:
    branch = get_branch(branch_id)
    if not branch:
        return False, "Sucursal no registrada.", 0.0

    distance = haversine_distance_meters(lat, lon, branch["lat"], branch["lon"])
    radius = int(branch.get("radio") or settings.default_branch_radius_meters)
    if distance > radius:
        return False, "Estas fuera de la geocerca permitida.", distance
    return True, "", distance
