# WETUDY · PR533 — Privilegios no cubiertos por RLS (15/11/2026)

## Hallazgo probado en producción, sin consultar filas
Educación Marketplace Supabase (PostgreSQL 17), metadatos SELECT exclusivamente:
- 79 tablas ordinarias/particionadas en schema public; todas tienen RLS ON.
- 47 tablas conceden TRUNCATE a anon y 48 a authenticated, entre ellas profiles, listing_photos, user_roles, school_access_codes, notifications, listing_offers y saved_searches. La tabla listings fue corregida por una segunda migración productiva autorizada por el fundador, **p0_listings_remove_residual_unsafe_privileges_20261115, versión 20261115183418**.
- La migración anterior p0_listings_atomic_privacy_acl_20261115, versión 20261115180541, conserva anon SELECT 0/36 y authenticated SELECT 33/36, CP exacto no legible.
- Los privilegios TRUNCATE, REFERENCES, TRIGGER y MAINTAIN no se controlan por la misma semántica de RLS. Su existencia no demuestra explotación ni conectividad SQL del público; requiere cierre por mínimo privilegio.
- ALTER DEFAULT PRIVILEGES: **postgres y supabase_admin** mantienen por defecto los cuatro privilegios para anon y authenticated en futuras tablas public. Hay que aprobar y revisar por separado el endurecimiento de defaults para evitar recurrencia.

## Propuesta, no ejecutada
`scripts/p0_public_tables_nonrls_privileges_review_only.sql` fija una allowlist de las 48 tablas hoy afectadas; BEGIN/COMMIT, checks 79-tablas, RLS activo, ausencia de grants fuera de allowlist y postflight para *todas* las tablas; REVOKE sólo los 4 privilegios no utilizados por el cliente. No cambia SELECT/INSERT/UPDATE/DELETE, datos ni RLS. El usuario NO ha autorizado explícitamente todavía modificar las otras 48 tablas; **NO EJECUTAR**.

`scripts/p0_public_tables_nonrls_privileges_readonly.sql`: informe de catálogo read-only sin filas.
`scripts/p0_public_tables_nonrls_privileges_pg17.py`: base PG17 local descartable, con tabla listings ya endurecida + 48 afectados + 30 no afectados: éxito, idempotencia, conservación de CRUD ordinario y fallos de seguridad simulados por schema drift, RLS off y grant a tabla no incluida. CI en workflow local PostgreSQL/Storage.
Las dos migraciones antiguas (20261111083000, 20261111084000) cubrían únicamente 10 de estas tablas y no deben aplicarse como sustituto de este alcance completo.

## Condiciones de salida
1. Solicitar aprobación explícita para ampliar cambio de privilegios a las 48 tablas (no inferir de autorización previa limitada a listings).
2. Confirmar CI PostgreSQL17 SUCCESS y plan de recuperación. La reversión de estos permisos no significa que se deban reabrir automáticamente por ser inseguros; restaurar solo bajo análisis.
3. Aplicar en transacción y verificar las 79 tablas, roles y operaciones esperadas con SELECT read-only, además de HTTP smoke en Vercel.
4. Auditar ALTER DEFAULT PRIVILEGES para ambos propietarios con autorización separada; verificar que nuevas tablas no reciban TRUNCATE de cliente automáticamente.
5. Piloto AMPA 0/3, DR integral pendiente y E2E autenticado real pendiente: NO-GO apertura, aunque las rutas públicas de marketplace/feed/ficha DEMO sigan HTTP 200.

Referencias:
- https://www.postgresql.org/docs/17/ddl-priv.html
- https://supabase.com/docs/guides/api/securing-your-api
