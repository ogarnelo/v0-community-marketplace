# WETUDY — Ola 1 de revocación SQL no-RLS (PREPARADA; SIN APLICAR)

**11/11/2026. Incidencia P0 #375.**

La consulta de metadatos de Supabase identificó permisos `TRUNCATE`/`REFERENCES` concedidos a `anon` y `authenticated` en numerosas tablas. PostgreSQL no somete `TRUNCATE` a RLS; no se ha confirmado una explotación mediante la web.

## Alcance limitado

La migración `20261111084000_pilot_wave1_revoke_client_non_rls_privileges.sql` propone revocar **exclusivamente** `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN` sobre ocho tablas sensibles: `profiles`, `listings`, `listing_photos`, `schools`, `school_codes`, `school_access_codes`, `user_roles` y `notifications`, para los roles `anon` y `authenticated`. Se preservan `SELECT/INSERT/UPDATE/DELETE` y RLS.

La consulta de dependencias realizada en producción, **solo metadatos**, encontró:
- `listings`: 26 FK entrantes, 5 salientes, 2 triggers de usuario
- `profiles`: 23 FK entrantes, 2 salientes
- `schools`: 22 FK entrantes
- `listing_photos`: 1 FK saliente
- `notifications`: 1 FK saliente
- `school_access_codes`: 2 FK salientes
- `school_codes`: 1 FK saliente
- `user_roles`: 2 FK salientes

Las FK existentes no se eliminan al revocar `REFERENCES`; pero hay que revisar flujos de modificación de esquema, triggers y funciones de ejecución especial antes de aplicar. Estas cifras son metadatos; no certifican compatibilidad con todas las operaciones.

## Ensayo aislado

`scripts/pilot-wave1-client-privilege-regression.py` usa una base PostgreSQL 17 nueva **local** y desechable para conceder todos los privilegios a dos roles sintéticos, ejecutar la migración, comprobar la revocación de 64 concesiones, conservar 64 permisos DML, repetir y probar un re-grant. La ejecución depende del workflow de recuperación sintética. No se conecta con Supabase, no utiliza registros reales ni envía emails.

## Puertas antes de migrar de verdad

1. Confirmar un backup reciente y que puede restaurarse el alcance necesario, incluyendo permisos, Auth/Storage relevantes y un plan de contingencia.
2. Revisar funciones `SECURITY DEFINER`, RPC, procesos administrativos, permisos de mantenimiento y dependencias en estas ocho tablas.
3. Preparar consulta de metadatos antes/después, validación RLS funcional con cuentas QA autorizadas y rollback específico.
4. Aplicar dentro de una ventana controlada y detener la activación del piloto si aparece un fallo.

**No ejecutar automáticamente esta migración**, ni la de PR #405, ni las cinco migraciones de alertas. Las concesiones predeterminadas gestionadas por Supabase también requieren revisión; revocar tablas existentes no previene concesiones futuras.

No activar centros ni correos; seis anuncios DEMO intactos. Mantener #375 abierta.
