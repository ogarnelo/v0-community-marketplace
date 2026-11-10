# WETUDY — Preflight integral de cinco migraciones de alertas

Estado 10/11/2026: **no aplicado a Supabase producción**, incidencias vinculadas #375.

Se ha extendido el inventario de solo lectura para detectar, antes de activar el recuperador, las siguientes capacidades: (1) tabla de intenciones, RPCs de prepare/begin/accept/ambiguous y health; (2) RPC de cuarentena y health; (3) conciliación manual y health; (4) índice UNIQUE parcial de ID de mensaje Resend; (5) funciones de cierre, reencolado y aplazamiento protegidas por lease y TTL vigentes.

El preflight consulta los catálogos PostgreSQL con `BEGIN TRANSACTION READ ONLY`, no invoca RPCs que muten filas, no inspecciona destinatarios, y no crea ni borra tablas. En el worker, se añade una lectura previa del health de conciliación manual. Si el esquema está incompleto, se devuelve un error técnico seguro y **NO se reclama ningún trabajo**. Aunque este guard se añada en GitHub, no significa que las cinco migraciones se hayan instalado en Supabase.

La cuarta y quinta capacidades quedan por ahora en el preflight manual de despliegue; el worker no consulta `pg_catalog` vía PostgREST en caliente, evitando crear funciones con permisos adicionales. Un chequeo de *presencia* de índice no certifica por sí solo su comportamiento: la CI PostgreSQL aislada verifica el conflicto de identificadores de proveedor.

**Criterios previos:** respaldo restaurable/PITR revisados, copia del resultado de lectura, aplicación ordenada de migraciones y revisión de RLS/advisors. Mantener los avisos apagados y sin cron; conservar seis anuncios DEMO; no realizar envíos reales sin E2E autorizada. No cerrar la P0 #375.
