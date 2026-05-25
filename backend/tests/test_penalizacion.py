def test_auto_close_skips_same_day(client, mock_supabase):
    """Entrada de hoy no se cierra (last_dt.date() >= today)"""
    mock_supabase.queue(
        [{"id": "emp-1", "nombre": "Juan", "hora_entrada": "09:00", "hora_salida": "18:00", "sucursal_id": "s1"}],
    )

    resp = client.post("/api/records/auto-close")
    assert resp.status_code == 200
    data = resp.json()
    assert data["cerrados"] == 0
    assert data["errores"] == 0


def test_auto_close_skips_weekend(client, mock_supabase):
    """Entrada de domingo se salta (weekday() >= 5)"""
    mock_supabase.queue(
        [{"id": "emp-1", "nombre": "Juan", "hora_entrada": "09:00", "hora_salida": "18:00", "sucursal_id": "s1"}],
        [{"id": "r1", "empleado": "Juan", "tipo": "Entrada", "fecha_hora": "2025-06-01T08:30:00"}],
    )
    resp = client.post("/api/records/auto-close")
    data = resp.json()
    assert data["saltados"] == 1
    assert data["cerrados"] == 0


def test_auto_close_dedup(client, mock_supabase):
    """Entrada ya auto-cerrada previamente se salta"""
    mock_supabase.queue(
        [{"id": "emp-1", "nombre": "Juan", "hora_entrada": "09:00", "hora_salida": "18:00", "sucursal_id": "s1"}],
        [{"id": "r1", "empleado": "Juan", "tipo": "Entrada", "fecha_hora": "2025-05-30T08:00:00"}],
        [{"id": "exists"}],  # dedup query → ya hay auto-close
    )
    resp = client.post("/api/records/auto-close")
    data = resp.json()
    assert data["cerrados"] == 0
    assert data["saltados"] == 1


def test_auto_close_creates_olvido(client, mock_supabase):
    """Viernes laboral sin salida → se cierra con OLVIDO REGISTRO"""
    mock_supabase.queue(
        [{"id": "emp-1", "nombre": "Juan", "hora_entrada": "09:00", "hora_salida": "18:00", "sucursal_id": "s1"}],
        [{"id": "r1", "empleado": "Juan", "tipo": "Entrada", "fecha_hora": "2025-05-30T08:00:00"}],
        [],  # dedup query → no existe
        [],  # permiso query → no tiene
        [{"id": "close-1"}],  # insert ok
    )
    resp = client.post("/api/records/auto-close")
    data = resp.json()
    assert data["cerrados"] == 1
    assert data["saltados"] == 0


def test_auto_close_saltado_por_permiso(client, mock_supabase):
    """Entrada con permiso aprobado no se cierra"""
    mock_supabase.queue(
        [{"id": "emp-1", "nombre": "Juan", "hora_entrada": "09:00", "hora_salida": "18:00", "sucursal_id": "s1"}],
        [{"id": "r1", "empleado": "Juan", "tipo": "Entrada", "fecha_hora": "2025-05-30T08:00:00"}],
        [],  # dedup → no existe
        [{"id": "perm-1", "estatus": "aprobado"}],  # tiene permiso
    )
    resp = client.post("/api/records/auto-close")
    data = resp.json()
    assert data["cerrados"] == 0
