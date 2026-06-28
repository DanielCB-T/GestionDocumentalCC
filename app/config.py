"""Configuración central leída de variables de entorno.

Todo se inyecta vía docker-compose; no hay valores secretos en el código.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


def _env(key: str, default: str | None = None) -> str:
    val = os.getenv(key, default)
    if val is None:
        raise RuntimeError(f"Falta la variable de entorno obligatoria: {key}")
    return val


@dataclass(frozen=True)
class Settings:
    # PostgreSQL
    db_host: str = os.getenv("DB_HOST", "postgres")
    db_port: int = int(os.getenv("DB_PORT", "5432"))
    db_name: str = os.getenv("DB_NAME", "stitch")
    db_user: str = os.getenv("DB_USER", "stitch")
    db_password: str = os.getenv("DB_PASSWORD", "stitch")

    # Redis
    redis_host: str = os.getenv("REDIS_HOST", "redis")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    cache_ttl: int = int(os.getenv("CACHE_TTL", "60"))  # segundos

    # MinIO
    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "minio:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "documentos")
    minio_secure: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"

    @property
    def dsn(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
