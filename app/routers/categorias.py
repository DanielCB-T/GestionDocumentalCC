"""Endpoints de categorías (clasificación de documentos).

Usado por la sección "Documentos" (Explorador de documentos):
  - GET  /categorias                 -> lista de carpetas/categorías con conteo
  - POST /categorias                 -> botón "Crear categoría"
  - GET  /categorias/{id}/documentos -> documentos dentro de una categoría
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

import cache
from database import get_cursor
from schemas import CategoriaCrear, CategoriaOut, DocumentoOut

router = APIRouter(prefix="/categorias", tags=["categorias"])


@router.get("", response_model=list[CategoriaOut])
def listar():
    """Lista todas las categorías junto con la cantidad de documentos que tienen."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT c.id, c.nombre, c.icono,
                   count(d.id) AS total_documentos
            FROM categorias c
            LEFT JOIN documentos d
                   ON d.categoria_id = c.id AND d.eliminado_en IS NULL
            GROUP BY c.id, c.nombre, c.icono
            ORDER BY c.nombre
            """
        )
        return cur.fetchall()


@router.post("", response_model=CategoriaOut, status_code=201)
def crear(categoria: CategoriaCrear):
    """Crea una nueva categoría (carpeta) para clasificar documentos."""
    nombre = categoria.nombre.strip()
    if not nombre:
        raise HTTPException(400, "El nombre de la categoría es obligatorio")

    with get_cursor() as cur:
        cur.execute("SELECT id FROM categorias WHERE nombre ILIKE %s", (nombre,))
        if cur.fetchone():
            raise HTTPException(409, "Ya existe una categoría con ese nombre")

        cur.execute(
            """
            INSERT INTO categorias (nombre, icono)
            VALUES (%s, %s)
            RETURNING id, nombre, icono
            """,
            (nombre, categoria.icono or "folder"),
        )
        nueva = cur.fetchone()

    cache.invalidate_all()
    nueva["total_documentos"] = 0
    return nueva


@router.get("/{categoria_id}/documentos", response_model=list[DocumentoOut])
def documentos_de_categoria(categoria_id: int):
    """Documentos clasificados dentro de una categoría (vista de carpeta)."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM categorias WHERE id = %s", (categoria_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Categoría no encontrada")

        cur.execute(
            """
            SELECT * FROM v_documentos
            WHERE categoria_id = %s
            ORDER BY fecha_creacion DESC
            """,
            (categoria_id,),
        )
        return cur.fetchall()
