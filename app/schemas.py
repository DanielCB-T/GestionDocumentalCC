"""Esquemas Pydantic: contratos de entrada/salida de la API."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class Estado(str, Enum):
    pendiente = "pendiente"
    completado = "completado"
    en_revision = "en_revision"
    archivado = "archivado"


class Prioridad(str, Enum):
    baja = "baja"
    normal = "normal"
    alta = "alta"
    critica = "critica"


class DocumentoOut(BaseModel):
    id: int
    folio: str
    nombre: str
    tipo: str
    icono: str | None = None
    estado: Estado
    prioridad: Prioridad
    fecha_creacion: datetime
    tamano_bytes: int | None = None
    descripcion: str | None = None
    anio_creacion: int | None = None
    categoria_id: int | None = None
    categoria_nombre: str | None = None
    autor_id: int
    autor_nombre: str
    autor_iniciales: str
    es_sistema: bool


class PaginaDocumentos(BaseModel):
    """Coincide con el footer del HTML: 'Mostrando 1-4 de 42 resultados'."""
    items: list[DocumentoOut]
    total: int
    pagina: int
    por_pagina: int


class UsuarioOut(BaseModel):
    id: int
    nombre: str
    correo: str | None = None
    iniciales: str
    es_sistema: bool


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    icono: str
    total_documentos: int = 0


class CategoriaCrear(BaseModel):
    nombre: str
    icono: str | None = None
