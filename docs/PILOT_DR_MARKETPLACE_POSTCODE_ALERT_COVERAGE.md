# WETUDY — Cobertura de recuperación actualizada para marketplace, CP y alertas

Actualización de 10/11/2026, incidencia P0 #375.

## Inventario contrastado en Supabase

Consulta **solo de nombres de tablas**, sin contenido personal: en Education Marketplace hay **79 tablas públicas**. El informe del 09/11 incluía 77: faltaban `marketplace_alert_outbox` y `marketplace_postal_centroids`.

Se han añadido ambas a `scripts/pilot-dr-scope-audit.py`. La cobertura sintética local continúa en **6 de 79 tablas (7,6 %)**. Esto **NO es porcentaje de bytes protegidos ni de datos reales recuperables**: describe únicamente el número de tablas públicas ensayadas en la recuperación sintética.

## Recorridos que siguen sin estar cubiertos por el ensayo sintético

Además de perfiles, listados, conversaciones y transacciones, el informe separa ahora el recorrido **búsqueda de proximidad + alertas**: centroides de códigos postales, outbox, búsquedas y coincidencias guardadas, preferencias, entregas de correo y supresiones.

La copia cifrada real y la recuperación parcial del 10/11 han superado sus workflows. Sin embargo, la recuperación parcial del directorio escolar **no sustituye** una restauración de datos de familias, anuncios, imágenes, conversaciones ni pagos.

La opción `--require-full-coverage` sigue fallando expresamente y la suite crítica verifica que permanece bloqueada. No se han descargado datos, no se ha usado la clave del backup, no hay DDL ni cron nuevo y no se ha cambiado el marketplace.

## Siguientes puertas

1. Revisión de un ensayo de recuperación ampliado, con datos **únicamente sintéticos**, que incluya los recorridos críticos y controles de RLS.
2. Acreditar por separado las rutas de recuperación de Auth, Storage y secretos; no confundir capacidad de `pg_dump` con reconstrucción íntegra de servicio.
3. Aplicar las cinco migraciones solo tras decisión explícita sobre riesgo de recuperación, validación de preflight y rollback, manteniendo el worker apagado.
4. E2E con buzones QA adultos autorizados, y conciliación operativa antes de habilitar alertas.

No cerrar #375 por la actualización del inventario.
