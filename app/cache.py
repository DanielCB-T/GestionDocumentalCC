"""Capa de caché con Redis.

Cachea listados y búsquedas (operaciones de lectura frecuentes y costosas).
Cualquier escritura sobre documentos invalida el namespace "docs:*".
"""
from __future__ import annotations

import json
from typing import Any

import redis

from config import settings

_client = redis.Redis(
    host=settings.redis_host,
    port=settings.redis_port,
    decode_responses=True,
)

PREFIX = "docs:"


def get_json(key: str) -> Any | None:
    raw = _client.get(PREFIX + key)
    return json.loads(raw) if raw else None


def set_json(key: str, value: Any, ttl: int | None = None) -> None:
    _client.set(
        PREFIX + key,
        json.dumps(value, default=str),
        ex=ttl or settings.cache_ttl,
    )


def invalidate_all() -> None:
    """Borra todo el namespace de documentos tras una escritura."""
    for k in _client.scan_iter(match=PREFIX + "*"):
        _client.delete(k)


def ping() -> bool:
    try:
        return bool(_client.ping())
    except Exception:
        return False
