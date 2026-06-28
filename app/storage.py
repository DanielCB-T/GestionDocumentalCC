"""Almacenamiento de archivos en MinIO (compatible S3).

PostgreSQL guarda solo los metadatos; el binario del documento vive aquí.
La columna documentos.ruta_archivo guarda la object key.
"""
from __future__ import annotations

import io
from datetime import timedelta

from minio import Minio
from minio.error import S3Error

from config import settings

_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure,
)


def ensure_bucket() -> None:
    """Crea el bucket si no existe (idempotente, se llama al arrancar)."""
    if not _client.bucket_exists(settings.minio_bucket):
        _client.make_bucket(settings.minio_bucket)


def subir(object_key: str, data: bytes, content_type: str) -> int:
    """Sube bytes a MinIO y devuelve el tamaño almacenado."""
    stream = io.BytesIO(data)
    _client.put_object(
        settings.minio_bucket,
        object_key,
        stream,
        length=len(data),
        content_type=content_type,
    )
    return len(data)


def descargar_stream(object_key: str):
    """Obtiene el archivo directamente de MinIO como un stream.
    
    Esto evita los problemas de firmas (SignatureDoesNotMatch) 
    con las URLs prefirmadas en redes de Docker.
    """
    return _client.get_object(settings.minio_bucket, object_key)


def borrar(object_key: str) -> None:
    try:
        _client.remove_object(settings.minio_bucket, object_key)
    except S3Error:
        pass  # el soft delete de metadatos es lo que manda


def ping() -> bool:
    try:
        _client.bucket_exists(settings.minio_bucket)
        return True
    except Exception:
        return False
