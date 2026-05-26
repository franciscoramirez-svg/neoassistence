from pydantic import BaseModel


class LoginRequest(BaseModel):
    name: str
    pin: str
    employee_number: str | None = None


class LoginResponse(BaseModel):
    ok: bool
    message: str
    user: dict | None = None
