def test_create_permiso(client, mock_supabase):
    mock_supabase.queue([{"id": "emp-1"}], [{"id": "perm-1"}])
    resp = client.post("/api/permisos", json={
        "empleado_nombre": "Juan Perez",
        "tipo": "permiso",
        "fecha_inicio": "2025-06-10",
        "fecha_fin": "2025-06-10",
        "motivo": "Cita medica",
    })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "id": "perm-1"}


def test_create_permiso_fail(client, mock_supabase):
    mock_supabase.queue([{"id": "emp-1"}], [])
    resp = client.post("/api/permisos", json={
        "empleado_nombre": "Nobody",
        "tipo": "permiso",
        "fecha_inicio": "2025-06-10",
        "fecha_fin": "2025-06-10",
    })
    assert resp.status_code == 400


def test_list_permisos_empty(client, mock_supabase):
    mock_supabase.queue([])
    resp = client.get("/api/permisos")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_permisos_with_filters(client, mock_supabase):
    mock_supabase.queue([
        {"id": "1", "empleado_nombre": "Juan", "estatus": "pendiente", "tipo": "permiso",
         "fecha_inicio": "2025-06-10", "fecha_fin": "2025-06-10"}
    ])
    resp = client.get("/api/permisos", params={"estatus": "pendiente", "empleado": "Juan"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_permiso_stats(client, mock_supabase):
    mock_supabase.queue([
        {"estatus": "pendiente"},
        {"estatus": "aprobado"},
        {"estatus": "rechazado"},
        {"estatus": "pendiente"},
    ])
    resp = client.get("/api/permisos/stats")
    assert resp.status_code == 200
    assert resp.json() == {"pendientes": 2, "aprobadas": 1, "rechazadas": 1, "total": 4}


def test_resolve_permiso(client, mock_supabase):
    mock_supabase.queue(
        [],
        [{"id": "perm-1", "empleado_nombre": "Juan Perez", "tipo": "permiso",
          "fecha_inicio": "2025-06-10", "fecha_fin": "2025-06-10"}],
    )
    resp = client.put("/api/permisos/perm-1/resolver", json={
        "estatus": "aprobado",
        "admin_comentario": "Ok",
    })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_resolve_permiso_rechazado(client, mock_supabase):
    mock_supabase.queue(
        [],
        [{"id": "perm-2", "empleado_nombre": "Maria", "tipo": "vacacion",
          "fecha_inicio": "2025-07-01", "fecha_fin": "2025-07-05"}],
    )
    resp = client.put("/api/permisos/perm-2/resolver", json={"estatus": "rechazado"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
