# WETUDY — Evidencia de ACL y rollback exacto antes de migrar

**11/11/2026 · P0 #375 · Sin cambios en producción.**

## Evidencia obtenida

Se ha ejecutado `scripts/pilot-acl-rollback-evidence-readonly.sql` contra Education Marketplace en una transacción `READ ONLY`. Examina exclusivamente `pg_class` y ACL de las **11 tablas** elegidas en las migraciones preparadas #405 (3 tablas) y #408 (8 tablas), dos roles cliente y ocho permisos por rol. No lee filas personales.

**Estado actual medido:** de los **88 privilegios no-RLS** a retirar (11 tablas × 2 roles × 4 privilegios), **88 siguen concedidos** en Supabase. Ninguna de las dos migraciones de privilegios está aplicada. Se verifica además la identidad del **grantor** en `aclexplode(relacl)` y se distingue el permiso **efectivo** de un grant **directo**.

## Procedimiento previsto — no es autorización de despliegue

1. **Antes:** comprobar copia reciente, restauración íntegra dentro del alcance acordado y método de contingencia. Guardar fuera del repo un resultado fechado del SQL de evidencias, commit/timestamp exacto de las dos migraciones y operador. Revisar cambios de ACL no esperados y titulares de grants.
2. **Preflight:** confirmar que están presentes las 11 tablas, la cobertura real de `anon` y `authenticated`, el estado de dependencias y compatibilidad de API, RPC, triggers y funciones de mantenimiento. Mantener los avisos apagados.
3. **Aplicación controlada:** aplicar solamente la migración autorizada, primero la de tres tablas y más tarde la ola de ocho, una por vez, con observación. **No mezclar** con las cinco migraciones de alertas o con activación del worker.
4. **Después:** volver a capturar el mismo SQL. Exigir que desaparezcan los cuatro privilegios peligrosos para los dos roles en las tablas objetivo, sin pérdida de `SELECT/INSERT/UPDATE/DELETE`. Comprobar RLS y operaciones clave con cuentas QA adultas autorizadas. Si hay desviación o error, detener el proceso.
5. **Rollback excepcional:** restaurar exclusivamente las concesiones realmente presentes **en la fotografía previa** que deban recuperarse, por tabla, rol, permiso y grantor, respetando `WITH GRANT OPTION` cuando proceda. Nunca utilizar un `GRANT ALL` indiscriminado ni repetir instrucciones genéricas que creen permisos inexistentes antes. Asegurar que el operador tiene autorización y los permisos de grantor requeridos. Registrar efectos y volver a auditar.

## Limitaciones críticas

PostgreSQL puede sumar permisos de un rol desde otros roles o desde `PUBLIC`; por eso el informe recoge tanto grants directos como privilegios efectivos, y una simple revocación puede no reducir el acceso efectivo. Según documentación oficial, `REVOKE` de un usuario/grantor también puede dejar otros grants activos. La fotografía de ACL **no sustituye una restauración probada** de Auth, Storage y base de datos. La copia de seguridad previa expiraba el 17/11/2026 y debe comprobarse frescura real al aplicar.

Los siguientes recursos son procedimientos de preparación, **no ejecución productiva**:
- `scripts/pilot-acl-rollback-evidence-readonly.sql`.
- `supabase/migrations/20261111083000_marketplace_revoke_client_table_wide_privileges.sql` (#405).
- `supabase/migrations/20261111084000_pilot_wave1_revoke_client_non_rls_privileges.sql` (#408).

**No se han enviado emails, ni activado centros, ni alterado los seis DEMO.** Mantener #375 abierta y seis migraciones anteriores más la ola 1 (siete pendientes en GitHub).

Referencia: https://www.postgresql.org/docs/17/sql-revoke.html
