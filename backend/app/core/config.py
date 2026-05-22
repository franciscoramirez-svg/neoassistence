import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", ".env"), 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

    app_timezone: str = "America/Mexico_City"
    default_branch_radius_meters: int = 150
    supabase_url: str = Field(default="")
    supabase_service_role_key: str = Field(default="")
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    smtp_host: str = Field(default="smtp.gmail.com")
    smtp_port: int = Field(default=587)
    smtp_user: str = Field(default="")
    smtp_password: str = Field(default="")
    email_from: str = Field(default="")
    vapid_public_key: str = Field(default="")
    vapid_private_key: str = Field(default="")


settings = Settings()
