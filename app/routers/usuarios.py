"""Endpoints de usuarios (la columna 'Autor' de la tabla)."""
from __future__ import annotations

from fastapi import APIRouter

from database import get_cursor
from schemas import UsuarioOut

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("", response_model=list[UsuarioOut])
def listar():
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, nombre, correo, iniciales, es_sistema "
            "FROM usuarios WHERE activo ORDER BY nombre"
        )
        return cur.fetchall()
