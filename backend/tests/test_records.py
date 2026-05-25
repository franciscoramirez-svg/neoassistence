from unittest.mock import patch


def test_get_records_empty(client, mock_supabase):
    mock_supabase.queue([])
    resp = client.get("/api/records")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["data"]["items"] == []


def test_post_record(client, mock_supabase):
    with (
        patch("app.services.records.get_active_employee_by_name", return_value={
            "id": "emp-1", "nombre": "Juan Perez", "sucursal_id": "branch-1", "tolerancia_minutos": 15,
            "hora_entrada": "09:00", "hora_salida": "18:00",
        }),
        patch("app.services.records.validate_geofence", return_value=(True, "", 0.0)),
        patch("app.services.records.validate_flow", return_value=(True, "")),
        patch("app.services.records.employee_has_recent_duplicate", return_value=False),
    ):
        mock_supabase.queue([{"id": "rec-1"}])
        payload = {
            "employee_name": "Juan Perez",
            "movement_type": "Entrada",
            "lat": 25.5,
            "lon": -100.3,
            "source": "web",
        }
        resp = client.post("/api/records", json=payload)
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


def test_update_record_admin(client, mock_supabase):
    mock_supabase.queue([{"id": "rec-1", "estatus": "Justificado", "justificacion": "Trafico"}])
    resp = client.put("/api/admin/records/rec-1", json={"estatus": "Justificado", "justificacion": "Trafico"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["data"]["estatus"] == "Justificado"


def test_update_record_admin_not_found(client, mock_supabase):
    mock_supabase.queue([])
    resp = client.put("/api/admin/records/rec-404", json={"estatus": "Justificado"})
    assert resp.status_code == 404


def test_update_record_admin_empty_payload(client):
    resp = client.put("/api/admin/records/rec-1", json={})
    assert resp.status_code == 400


def test_calendar_empty(client, mock_supabase):
    mock_supabase.queue([])
    resp = client.get("/api/records/calendar", params={"mes": "2025-06"})
    assert resp.status_code == 200
    assert resp.json() == {}


def test_calendar_with_data(client, mock_supabase):
    mock_supabase.queue([
        {"id": "1", "empleado": "Juan", "fecha_hora": "2025-06-05T08:00:00", "estatus": "A Tiempo"},
        {"id": "2", "empleado": "Juan", "fecha_hora": "2025-06-05T17:00:00", "estatus": "A Tiempo"},
        {"id": "3", "empleado": "Maria", "fecha_hora": "2025-06-06T08:30:00", "estatus": "Retardo 1-15 min"},
    ])
    resp = client.get("/api/records/calendar", params={"mes": "2025-06"})
    assert resp.status_code == 200
    result = resp.json()
    assert result["2025-06-05"] == "presente"
    assert result["2025-06-06"] == "retardo"


def test_calendar_filter_employee(client, mock_supabase):
    mock_supabase.queue([
        {"id": "1", "empleado": "Juan", "fecha_hora": "2025-06-05T08:00:00", "estatus": "A Tiempo"},
    ])
    resp = client.get("/api/records/calendar", params={"mes": "2025-06", "empleado": "Maria"})
    assert resp.status_code == 200
    assert resp.json() == {}


def test_export_excel(client, mock_supabase):
    mock_supabase.queue([
        {"id": "1", "empleado": "Juan", "fecha_hora": "2025-06-05T08:00:00", "tipo": "Entrada",
         "estatus": "A Tiempo", "min_retardo": 0, "sucursal_id": "s1", "justificacion": ""},
        {"id": "2", "empleado": "Maria", "fecha_hora": "2025-06-05T08:30:00", "tipo": "Entrada",
         "estatus": "Retardo 1-15 min", "min_retardo": 10, "sucursal_id": "s1", "justificacion": "Trafico"},
    ])
    resp = client.get("/api/records/export/excel")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
