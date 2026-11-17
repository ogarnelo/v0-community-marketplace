# WETUDY — Diagnóstico de los 16 DEFAULT ACL de supabase_admin (P0)

Lectura real de Supabase Education Marketplace, 17/11/2026:

- SQL executor `current_user=postgres`, `session_user=postgres`.
- `pg_has_role(current_user,'supabase_admin','MEMBER')=false` y `USAGE=false`: **el executor SQL disponible no está autorizado a modificar los privilegios por defecto de otro creador**.
- En `public`, los DEFAULT ACL de tablas nuevas creadas por `supabase_admin` siguen concediendo a `anon` y `authenticated` ocho permisos por rol (16). Los del creador `postgres` en `public` ya fueron tratados antes.
- Existen también grants por defecto en otros esquemas de servicios (`storage`, `graphql`, `graphql_public`, entre otros). **Fuera de alcance:** no tocarlos ni confundirlos con `public`.
- El estado actual de lectura de `public.listings` para `anon` es `false`; `authenticated UPDATE` y `service_role SELECT` son `true`. No confundir DEFAULT ACL de tablas FUTURAS con grants existentes o acceso efectivo vía RLS.

El repo ya contiene el candidato específico y bloqueado `scripts/p0_public_default_acl_supabase_admin_privileged_only_review.sql`. **No repetir ni ejecutar la migración con postgres**, porque la comprobación de membresía fallaría; no conceder a postgres membresía superadmin como atajo.

El nuevo `scripts/p0_supabase_admin_default_acl_executor_preflight_read_only.sql` sólo documenta y reproduce un preflight READ ONLY. El punto de intervención humana no es «ejecutar 16 SQL sueltos» sino obtener de la plataforma / soporte un **mecanismo oficial y legítimamente autorizado** para actuar como `supabase_admin`, o mantener la puerta P0 cerrada hasta disponer de él. Requerirá nueva autorización específica para cualquier SQL mutable.

Sin prueba en Auth, dos colegios o recuperación integral, el piloto sigue NO-GO.
