"""Acceso a PostgreSQL mediante un pool de conexiones (psycopg 3).

Se usa el esquema `stitch` fijado en el search_path de cada conexión, así
no hace falta calificar `stitch.documentos` en cada consulta.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import settings

# El pool se abre al importar y se reutiliza durante toda la vida del proceso.
pool = ConnectionPool(
    conninfo=settings.dsn,
    min_size=1,
    max_size=10,
    kwargs={"row_factory": dict_row, "options": "-c search_path=stitch,public"},
    open=True,
)


@contextmanager
def get_cursor() -> Iterator:
    """Devuelve un cursor dentro de una transacción.

    Hace commit si todo va bien, rollback si hay excepción.
    """
    with pool.connection() as conn:
        with conn.cursor() as cur:
            yield cur


def ping() -> bool:
    """Comprueba que la base de datos responde (para el healthcheck)."""
    try:
        with get_cursor() as cur:
            cur.execute("SELECT 1")
            return cur.fetchone() is not None
    except Exception:
        return False
