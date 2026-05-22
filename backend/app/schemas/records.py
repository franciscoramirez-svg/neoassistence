from pydantic import BaseModel, Field


class RecordCreateRequest(BaseModel):
    employee_name: str
    movement_type: str = Field(pattern="^(Entrada|Salida)$")
    lat: float
    lon: float
    source: str = "web"
    justification: str | None = None


class ApiMessage(BaseModel):
    ok: bool
    message: str
    data: dict | None = None
