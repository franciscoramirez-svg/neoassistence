import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from fastapi.testclient import TestClient
from app.main import app


class MockResult:
    def __init__(self, data=None):
        self.data = data or []


class MockSupabaseClient:
    def __init__(self):
        self._insert_data = None
        self._update_data = None
        self._upsert_data = None
        self._data = []
        self._execute_result = MockResult()

    def table(self, name):
        self._table_name = name
        return self

    def select(self, *args):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args):
        return self

    def eq(self, *args, **kwargs):
        return self

    def gte(self, *args):
        return self

    def lte(self, *args):
        return self

    def neq(self, *args):
        return self

    def insert(self, data):
        self._insert_data = data
        return self

    def update(self, data):
        self._update_data = data
        return self

    def delete(self, **kwargs):
        return self

    def upsert(self, data):
        self._upsert_data = data
        return self

    def execute(self):
        return self._execute_result

    def set_data(self, data):
        self._execute_result = MockResult(data=data)

    def get_insert_data(self):
        return self._insert_data

    def get_update_data(self):
        return self._update_data


MODULES_WITH_SUPABASE = [
    "app.api.routes.records",
    "app.api.routes.permisos",
    "app.api.routes.incidencias",
    "app.api.routes.branches",
    "app.api.routes.employees",
    "app.api.routes.reports",
    "app.api.routes.penalizacion",
    "app.api.routes.push",
    "app.api.routes.yts",
    "app.api.routes.debug",
    "app.api.routes.notifications",
    "app.api.routes.auth",
    "app.services.records",
    "app.services.employees",
    "app.services.branches",
]


@pytest.fixture(autouse=True)
def mock_all_supabase():
    mock_client = MockSupabaseClient()

    patcher_source = patch("app.services.supabase_client.get_supabase", return_value=mock_client)
    patcher_source.start()

    patchers = []
    for mod in MODULES_WITH_SUPABASE:
        try:
            p = patch(f"{mod}.get_supabase", return_value=mock_client)
            p.start()
            patchers.append(p)
        except Exception:
            pass

    yield mock_client

    patcher_source.stop()
    for p in patchers:
        p.stop()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_supabase(mock_all_supabase):
    return mock_all_supabase
