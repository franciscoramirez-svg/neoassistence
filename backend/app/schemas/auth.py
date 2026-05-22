from pydantic import BaseModel


class LoginRequest(BaseModel):
    name: str
    pin: str


class LoginResponse(BaseModel):
    ok: bool
    message: str
    user: dict | None = None
