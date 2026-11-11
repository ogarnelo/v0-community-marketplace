# WETUDY — Escrituras RLS después de restaurar búsquedas cercanas

11/11/2026 · Riesgo P0 #375 · **Solo datos y roles sintéticos en PostgreSQL 17 local**.

## Qué se añade

El ensayo de recuperación ya verificaba que dos familias ficticias no veían búsquedas, coincidencias o preferencias ajenas. Ahora también prueba operaciones de escritura **antes y después de restaurar** la copia.

Las pruebas comprueban que una familia puede cambiar **su propio radio** y **su propio código postal** y crear una búsqueda con su identidad; que cambiar datos de otra familia no modifica filas; y que un INSERT de búsqueda apropiándose de otra identidad falla por RLS. Además, el rol de familia no dispone de INSERT/UPDATE sobre las coincidencias, el outbox o los recibos de entrega.

Todas las escrituras autorizadas se ejecutan dentro de transacciones que terminan en `ROLLBACK`, y se vuelven a comparar las huellas de todas las filas. La restauración parcial requiere reproducir explícitamente los grants sintéticos de esquema y de columna; esto se comprueba con privilegios mínimos.

## Límites

No modifica permisos reales de WETUDY ni certifica las políticas RLS actuales de Supabase/GoTrue. No se envían correos ni se procesan pagos. No cambia los seis anuncios DEMO. Mantener apagadas las dos banderas de avisos y no aplicar las cinco migraciones de alertas sin plan integral de recuperación y E2E autorizada.
