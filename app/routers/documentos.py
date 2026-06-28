"""Endpoints de documentos.

Mapean directamente a la interfaz Stitch:
  - GET  /documentos              -> tabla principal + chips de filtro + paginación
  - GET  /documentos/buscar       -> campo "Buscar por nombre, autor o folio"
  - POST /documentos              -> botón "Nuevo Documento" (sube a MinIO)
  - GET  /documentos/{folio}/url  -> botón "Descargar" (URL prefirmada)
  - GET  /documentos/{folio}/ver  -> botón "Visualizar" (abre el archivo inline)
  - DELETE /documentos/{folio}    -> botón "Eliminar" (soft delete)
"""
from __future__ import annotations

import mimetypes
import re
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

import cache
import storage
from database import get_cursor
from schemas import DocumentoOut, Estado, PaginaDocumentos, Prioridad

router = APIRouter(prefix="/documentos", tags=["documentos"])

# Mapa chip de la UI -> vista SQL
VISTA_POR_FILTRO = {
    "todos": "v_documentos",
    "pendientes": "v_documentos_pendientes",
    "completados": "v_documentos_completados",
    "recientes": "v_documentos_recientes",
    "prioritarios": "v_documentos_prioritarios",
}

EXT_A_TIPO = {"pdf": "pdf", "xlsx": "xlsx", "docx": "docx",
              "csv": "csv", "pptx": "pptx"}


@router.get("", response_model=PaginaDocumentos)
def listar(
    filtro: Literal["todos", "pendientes", "completados",
                    "recientes", "prioritarios"] = "todos",
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(4, ge=1, le=100),
):
    """Tabla principal con filtro por chip y paginación."""
    cache_key = f"list:{filtro}:{pagina}:{por_pagina}"
    if (hit := cache.get_json(cache_key)) is not None:
        return hit

    vista = VISTA_POR_FILTRO[filtro]
    offset = (pagina - 1) * por_pagina

    with get_cursor() as cur:
        cur.execute(f"SELECT count(*) AS total FROM {vista}")
        total = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT * FROM {vista}
            ORDER BY fecha_creacion DESC
            LIMIT %s OFFSET %s
            """,
            (por_pagina, offset),
        )
        items = cur.fetchall()

    resultado = PaginaDocumentos(
        items=items, total=total, pagina=pagina, por_pagina=por_pagina
    ).model_dump()
    cache.set_json(cache_key, resultado)
    return resultado


@router.get("/buscar", response_model=list[DocumentoOut])
def buscar(q: str = Query(..., min_length=1)):
    """Búsqueda libre por nombre, folio o autor (usa los índices trigram)."""
    cache_key = f"search:{q.lower()}"
    if (hit := cache.get_json(cache_key)) is not None:
        return hit

    patron = f"%{q}%"
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT * FROM v_documentos
            WHERE nombre ILIKE %(p)s
               OR folio  ILIKE %(p)s
               OR autor_nombre ILIKE %(p)s
            ORDER BY fecha_creacion DESC
            LIMIT 50
            """,
            {"p": patron},
        )
        items = cur.fetchall()

    cache.set_json(cache_key, items)
    return items


@router.post("", response_model=DocumentoOut, status_code=201)
async def crear(
    autor_id: int = Form(...),
    titulo: str | None = Form(None),
    descripcion: str | None = Form(None),
    anio_creacion: int | None = Form(None),
    categoria_id: int | None = Form(None),
    estado: Estado = Form(Estado.completado),
    prioridad: Prioridad = Form(Prioridad.normal),
    archivo: UploadFile = File(...),
):
    """Sube un documento: el binario va a MinIO, los metadatos a Postgres.

    Reglas del formulario "Nuevo Documento" (Lista / Index):
      - Título es obligatorio (lo valida también el frontend); si no llega,
        se usa el nombre del archivo como respaldo.
      - El estado del nuevo documento siempre queda como "completado",
        sin importar lo que llegue en el campo `estado` (el selector de
        estado en el formulario está deshabilitado intencionalmente).
    """
    nombre_archivo = archivo.filename or "sin_nombre"
    nombre = (titulo or "").strip() or nombre_archivo
    ext = nombre_archivo.rsplit(".", 1)[-1].lower() if "." in nombre_archivo else ""
    tipo = EXT_A_TIPO.get(ext, "otro")
    contenido = await archivo.read()

    # El nuevo documento siempre se marca como completado de forma automática.
    estado_final = Estado.completado

    with get_cursor() as cur:
        # Genera el siguiente folio ST-#### de forma atómica.
        cur.execute(
            """
            SELECT coalesce(max(substring(folio from 4)::int), 0) + 1 AS siguiente
            FROM documentos
            """
        )
        folio = f"ST-{cur.fetchone()['siguiente']:04d}"
        object_key = f"{folio}/{nombre_archivo}"

        tamano = storage.subir(
            object_key, contenido,
            archivo.content_type or "application/octet-stream",
        )

        cur.execute(
            """
            INSERT INTO documentos
                (folio, nombre, tipo, estado, prioridad,
                 autor_id, tamano_bytes, ruta_archivo,
                 descripcion, anio_creacion, categoria_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (folio, nombre, tipo, estado_final.value, prioridad.value,
             autor_id, tamano, object_key,
             descripcion, anio_creacion, categoria_id),
        )
        nuevo_id = cur.fetchone()["id"]

        cur.execute(
            "INSERT INTO historial_documentos (documento_id, usuario_id, accion) "
            "VALUES (%s, %s, 'creado')",
            (nuevo_id, autor_id),
        )

        cur.execute("SELECT * FROM v_documentos WHERE id = %s", (nuevo_id,))
        doc = cur.fetchone()

    cache.invalidate_all()
    return doc


from fastapi.responses import StreamingResponse

@router.get("/{folio}/descargar")
def descargar(folio: str):
    """Descarga el documento de MinIO a través de la API."""
    if not re.match(r"^ST-\d{3,}$", folio):
        raise HTTPException(400, "Folio inválido")

    with get_cursor() as cur:
        cur.execute(
            "SELECT ruta_archivo, nombre FROM v_documentos WHERE folio = %s", (folio,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Documento no encontrado")
    if not row["ruta_archivo"]:
        raise HTTPException(409, "El documento no tiene archivo asociado")

    try:
        response = storage.descargar_stream(row["ruta_archivo"])
    except Exception as e:
        raise HTTPException(500, "Error al obtener el archivo desde almacenamiento")

    def iterfile():
        try:
            for chunk in response.stream(32768):
                yield chunk
        finally:
            response.release_conn()

    return StreamingResponse(
        iterfile(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{row["nombre"]}"'}
    )


@router.get("/{folio}/ver")
def visualizar(folio: str):
    """Sirve el documento para visualizarlo en el navegador (botón 'Visualizar').

    A diferencia de /descargar, no fuerza la descarga (usa
    Content-Disposition: inline) y trata de inferir el tipo MIME real del
    archivo para que el navegador pueda mostrarlo (PDF, imágenes, etc.)
    en una nueva pestaña en lugar de descargarlo.
    """
    if not re.match(r"^ST-\d{3,}$", folio):
        raise HTTPException(400, "Folio inválido")

    with get_cursor() as cur:
        cur.execute(
            "SELECT ruta_archivo, nombre FROM v_documentos WHERE folio = %s", (folio,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Documento no encontrado")
    if not row["ruta_archivo"]:
        raise HTTPException(409, "El documento no tiene archivo asociado")

    try:
        response = storage.descargar_stream(row["ruta_archivo"])
    except Exception:
        raise HTTPException(500, "Error al obtener el archivo desde almacenamiento")

    tipo_mime, _ = mimetypes.guess_type(row["nombre"])

    def iterfile():
        try:
            for chunk in response.stream(32768):
                yield chunk
        finally:
            response.release_conn()

    return StreamingResponse(
        iterfile(),
        media_type=tipo_mime or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{row["nombre"]}"'}
    )


@router.delete("/{folio}", status_code=204)
def eliminar(folio: str):
    """Soft delete: marca eliminado_en, no borra la fila (botón Eliminar)."""
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE documentos SET eliminado_en = now()
            WHERE folio = %s AND eliminado_en IS NULL
            RETURNING id
            """,
            (folio,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Documento no encontrado o ya eliminado")
        cur.execute(
            "INSERT INTO historial_documentos (documento_id, accion) "
            "VALUES (%s, 'eliminado')",
            (row["id"],),
        )

    cache.invalidate_all()
