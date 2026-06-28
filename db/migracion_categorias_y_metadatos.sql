-- =============================================================================
-- Migración: categorías + metadatos extendidos de documentos
-- =============================================================================
-- Este script es IDEMPOTENTE: puede ejecutarse varias veces sin error.
--
-- ¿Cuándo se necesita?
--   El archivo db/init.sql SOLO se ejecuta automáticamente la PRIMERA vez que
--   se crea el volumen de datos de Postgres (carpeta vacía). Si ya tienes el
--   sistema corriendo con datos (el volumen "pgdata" ya existe), Postgres NO
--   vuelve a correr init.sql al reiniciar el contenedor. Para esos casos,
--   ejecuta este script una sola vez contra tu base de datos ya existente.
--
-- Cómo ejecutarlo (ejemplos):
--   docker compose exec -T postgres psql -U stitch -d stitch \
--       < db/migracion_categorias_y_metadatos.sql
--
--   o, si usas psql directo:
--   psql "postgresql://stitch:stitch@localhost:5432/stitch" \
--       -f db/migracion_categorias_y_metadatos.sql
--
-- Si tu base de datos es nueva (instalación desde cero), NO necesitas correr
-- este script: init.sql ya incluye todos estos cambios.
-- =============================================================================

SET search_path TO stitch, public;

-- -----------------------------------------------------------------------------
-- 1) TABLA categorias (clasificación / carpetas del explorador)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    icono       VARCHAR(40)  NOT NULL DEFAULT 'folder',
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE categorias IS 'Categorías/clasificación de documentos (carpetas del explorador).';

-- -----------------------------------------------------------------------------
-- 2) NUEVAS COLUMNAS en documentos
-- -----------------------------------------------------------------------------
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS descripcion   TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS anio_creacion INTEGER;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS categoria_id  BIGINT;

-- Restricciones (se agregan solo si todavía no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_anio_creacion'
    ) THEN
        ALTER TABLE documentos
            ADD CONSTRAINT chk_anio_creacion
            CHECK (anio_creacion IS NULL OR anio_creacion BETWEEN 1900 AND 2200);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_documentos_categoria'
    ) THEN
        ALTER TABLE documentos
            ADD CONSTRAINT fk_documentos_categoria
            FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN documentos.fecha_creacion IS 'Fecha de subida del documento al sistema (antes llamada "fecha de creación").';
COMMENT ON COLUMN documentos.anio_creacion  IS 'Año de creación del documento original, indicado por el usuario al subirlo.';

-- -----------------------------------------------------------------------------
-- 3) ÍNDICE de categoría
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_documentos_categoria
    ON documentos(categoria_id) WHERE eliminado_en IS NULL;

-- -----------------------------------------------------------------------------
-- 4) VISTA v_documentos actualizada (agrega descripcion, anio_creacion, categoría)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_documentos AS
SELECT
    d.id, d.folio, d.nombre, d.tipo, d.icono, d.estado, d.prioridad,
    d.fecha_creacion, d.tamano_bytes, d.ruta_archivo,
    d.descripcion, d.anio_creacion,
    d.categoria_id, c.nombre AS categoria_nombre,
    u.id AS autor_id, u.nombre AS autor_nombre,
    u.iniciales AS autor_iniciales, u.es_sistema
FROM documentos d
JOIN usuarios u ON u.id = d.autor_id
LEFT JOIN categorias c ON c.id = d.categoria_id
WHERE d.eliminado_en IS NULL;

-- Las vistas dependientes (v_documentos_pendientes, etc.) usan SELECT * y
-- heredan las columnas nuevas automáticamente al recrearse v_documentos.
CREATE OR REPLACE VIEW v_documentos_pendientes  AS SELECT * FROM v_documentos WHERE estado = 'pendiente';
CREATE OR REPLACE VIEW v_documentos_completados AS SELECT * FROM v_documentos WHERE estado = 'completado';
CREATE OR REPLACE VIEW v_documentos_recientes   AS SELECT * FROM v_documentos WHERE fecha_creacion >= now() - INTERVAL '7 days';
CREATE OR REPLACE VIEW v_documentos_prioritarios AS SELECT * FROM v_documentos WHERE prioridad IN ('alta', 'critica');

-- -----------------------------------------------------------------------------
-- 5) Categorías iniciales de ejemplo (solo si la tabla está vacía)
-- -----------------------------------------------------------------------------
INSERT INTO categorias (nombre, icono)
SELECT v.nombre, v.icono
FROM (VALUES
    ('Finanzas',        'payments'),
    ('Legal',           'gavel'),
    ('Infraestructura', 'dns'),
    ('Estrategia',      'insights')
) AS v(nombre, icono)
WHERE NOT EXISTS (SELECT 1 FROM categorias);

-- Fin de la migración.
