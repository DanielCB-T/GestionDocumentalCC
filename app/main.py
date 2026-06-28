"""Stitch API · punto de entrada FastAPI.

Conecta los tres servicios del contenedor:
  PostgreSQL (metadatos) · Redis (caché) · MinIO (archivos)
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import cache
import database
import storage
from routers import categorias, documentos, usuarios


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Al arrancar: asegurar que el bucket de MinIO existe.
    storage.ensure_bucket()
    yield


app = FastAPI(
    title="Stitch · Gestión de Documentos",
    version="1.0.0",
    description="Backend para la interfaz Stitch (Python + Postgres + Redis + MinIO).",
    lifespan=lifespan,
)

# El frontend (HTML Stitch) corre en otro origen; habilitamos CORS abierto
# para desarrollo. En producción se restringiría a los dominios reales.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documentos.router)
app.include_router(usuarios.router)
app.include_router(categorias.router)


@app.get("/health", tags=["sistema"])
def health():
    """Estado de los tres servicios; útil para el healthcheck de Docker."""
    return {
        "api": "ok",
        "postgres": "ok" if database.ping() else "down",
        "redis": "ok" if cache.ping() else "down",
        "minio": "ok" if storage.ping() else "down",
    }


@app.get("/", tags=["sistema"])
def raiz():
    return {"servicio": "stitch-api", "docs": "/docs"}
