# WETUDY — Auditoría TOC de Auth y Storage sin acceder a datos

**11/11/2026 · P0 #375 · Control informativo de recuperación, no autorización de migración.**

## Alcance real verificado

Una consulta read-only a `information_schema.tables` de Supabase Education Marketplace ha identificado **79 tablas `public`**, **27 `auth`** y **10 `storage`**. El ensayo de recuperación cifrada ya comprobaba el inventario de 79 tablas `public`, pero de Auth/Storage solamente señalaba tres nombres; esa comprobación era insuficiente para conocer la cobertura del backup.

Se incorpora `scripts/pilot-managed-schema-toc-coverage.py` al ensayo de backup. Lee **exclusivamente** el archivo `pg_restore --list` generado localmente después de descifrar el respaldo, nunca filas de familias. Cuenta, para cada una de las 27 tablas Auth y 10 Storage conocidas, si el TOC contiene definición `TABLE` y sección `TABLE DATA`. Publica solo números por esquema. Un indicador estricto `--require-managed-toc` permite que la comprobación falle ante ausencias; no se activa todavía como bloqueo del flujo principal mientras no sepamos qué incluyen las copias heredadas.

## Por qué no certifica DR

Aunque un respaldo tenga 74/74 entradas TABLE/TABLE DATA gestionadas, **eso no significa** que haya restaurado usuarios, identidades, tokens, sesiones, RLS real, servicios GoTrue, configuración, claves, webhooks ni los objetos físicos de Storage. El registro `storage.objects` es un catálogo, no los bytes de los ficheros. Los TOC son metadatos; no se ha desplegado un entorno de Auth ni manipulado archivos privados.

El informe devuelve por diseño:
- `any_real_auth_or_storage_rows_restored: false`
- `physical_storage_object_bytes_recovered: false`
- `gotrue_runtime_restored: false`
- `full_disaster_recovery_certified: false`

## Modo de ejecución

La ejecución regular de `pilot-combined-encrypted-recovery.yml` se disparará con el siguiente commit en `main` que afecte al script o al workflow. La prueba lee el TOC del respaldo LEGACY disponible, no descarga ni reproduce tablas personales en un PostgreSQL nuevo. La recuperación parcial del directorio y de Storage sintético existente continúa por separado.

La nueva copia cifrada con ACL de la PR #412 sigue pendiente de `workflow_dispatch` manual, y su verificación específica de la PR #414 sigue negativa para el backup antiguo. Mantener siete migraciones sin aplicar, flags OFF, seis anuncios DEMO y #375 abierto.
