# WETUDY — RLS presente en el índice del backup, no necesariamente restaurado

**11/11/2026 · P0 #375 · Solo ensayo cifrado y metadatos.**

La comprobación de respaldo ya identificaba las 79 tablas públicas y las 27 tablas `auth` y 10 de `storage` mediante secciones `TABLE` y `TABLE DATA`. Una tabla incluida no implica que sus políticas de seguridad puedan recuperarse.

Una consulta **read-only** a `pg_policy` del proyecto Education Marketplace confirmó **140 políticas RLS** en `public` (73 tablas) y **3 políticas** en `storage` (una tabla) el 11/11/2026. El script `scripts/pilot-backup-rls-policy-toc-audit.py` lee únicamente el índice `pg_restore --list` tras descifrar el backup en el runner existente y cuenta las entradas `POLICY` de los esquemas. También determina si las 11 tablas sensibles que se quieren endurecer en dos olas aparecen en las entradas `POLICY`.

El modo habitual informa del resultado sin exigir que una copia anterior coincida con la línea de base actual: las políticas pueden haber cambiado entre la creación del backup y la auditoría. `--require-policy-baseline` permite **bloquear** diferencias en un ensayo posterior con referencia revisada.

**No concede una falsa certificación:** aunque aparezcan 143 políticas en el índice, no significa que se hayan restaurado ni que las familias queden aisladas con Auth/GoTrue y JWT reales. `pg_dump --no-acl` además excluye grants y no restituye los secretos, los tokens ni los archivos físicos de Storage. El resultado incluye explícitamente `policies_applied_to_restored_database:false`, `rls_runtime_authorization_certified:false` y `full_disaster_recovery_certified:false`.

No toca Supabase, no lee registros privados, no activa colegios ni correos, y no aplica las siete migraciones pendientes. Mantener P0 #375 abierta.
