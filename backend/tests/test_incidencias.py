def test_create_incidencia(client, mock_supabase):
    mock_supabase.queue([{"id": "emp-1"}], [{"id": "inc-1"}])
    resp = client.post("/api/incidencias", json={
        "empleado_nombre": "Juan Perez",
        "tipo": "retardo",
        "fecha": "2025-06-05",
        "hora": "08:30",
        "motivo": "Trafico",
    })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "id": "inc-1"}


def test_create_incidencia_fail(client, mock_supabase):
    mock_supabase.queue([{"id": "emp-1"}], [])
    resp = client.post("/api/incidencias", json={
        "empleado_nombre": "Nobody",
        "tipo": "retardo",
        "fecha": "2025-06-05",
    })
    assert resp.status_code == 400


def test_list_incidencias_empty(client, mock_supabase):
    mock_supabase.queue([])
    resp = client.get("/api/incidencias")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_incidencias_with_filters(client, mock_supabase):
    mock_supabase.queue([
        {"id": "1", "empleado_nombre": "Juan", "estatus": "pendiente", "tipo": "retardo",
         "fecha": "2025-06-05", "hora": "08:30"}
    ])
    resp = client.get("/api/incidencias", params={"estatus": "pendiente", "empleado": "Juan"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_incidencia_stats(client, mock_supabase):
    mock_supabase.queue([
        {"estatus": "pendiente"},
        {"estatus": "aprobada"},
        {"estatus": "rechazada"},
    ])
    resp = client.get("/api/incidencias/stats")
    assert resp.status_code == 200
    assert resp.json() == {"pendientes": 1, "aprobadas": 1, "rechazadas": 1, "total": 3}


def test_resolve_incidencia_aprobada_with_registro(client, mock_supabase):
    mock_supabase.queue(
        [],
        [{"id": "inc-1", "empleado_nombre": "Juan Perez", "tipo": "retardo",
          "fecha": "2025-06-05", "registro_id": "rec-1", "motivo": "Trafico"}],
    )
    resp = client.put("/api/incidencias/inc-1/resolver", json={
        "estatus": "aprobada",
        "admin_comentario": "Justificado",
    })
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_resolve_incidencia_rechazada(client, mock_supabase):
    mock_supabase.queue(
        [],
        [{"id": "inc-2", "empleado_nombre": "Maria", "tipo": "retardo",
          "fecha": "2025-06-05", "registro_id": None, "motivo": "Olvide checar"}],
    )
    resp = client.put("/api/incidencias/inc-2/resolver", json={"estatus": "rechazada"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_resolve_incidencia_aprobada_no_registro(client, mock_supabase):
    mock_supabase.queue(
        [],
        [{"id": "inc-3", "empleado_nombre": "Luis", "tipo": "retardo",
          "fecha": "2025-06-05", "registro_id": None, "motivo": "Llegue tarde"}],
    )
    resp = client.put("/api/incidencias/inc-3/resolver", json={"estatus": "aprobada"})
    assert resp.status_code == 200
