"""Application configuration handling."""

import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=BASE_DIR / ".env")


class Settings:
    """Simple settings object backed by environment variables."""

    def __init__(self) -> None:
        self.database_url_env = os.getenv("DATABASE_URL")
        self.app_env = os.getenv("APP_ENV", "dev")
        self.app_port = int(os.getenv("APP_PORT", "8000"))
        self.database_host = os.getenv("DATABASE_HOST", "localhost")
        self.database_port = os.getenv("DATABASE_PORT", "5432")
        self.database_name = os.getenv("DATABASE_NAME", "postgres")
        self.database_user = os.getenv("DATABASE_USER", "postgres")
        self.database_password = os.getenv("DATABASE_PASSWORD", "")
        self.database_sslmode = os.getenv("DATABASE_SSLMODE", "disable")
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        raw_origins = os.getenv("ALLOWED_ORIGINS", "")
        self.allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()] or [
            "http://localhost:2021"
        ]
        self.auth_disabled = os.getenv("AUTH_DISABLED", "false").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

    @property
    def database_url(self) -> str:
        if self.database_url_env:
            return self.database_url_env
        password = quote_plus(self.database_password)
        base = (
            f"postgresql://{self.database_user}:{password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
        )
        return f"{base}?sslmode={self.database_sslmode}" if self.database_sslmode else base


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
