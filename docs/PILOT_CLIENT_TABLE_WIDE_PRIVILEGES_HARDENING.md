# WETUDY — Endurecimiento de privilegios no protegidos por RLS

**Fecha:** 11 noviembre 2026. **P0:** #375. **Estado:** migración preparada en repositorio; NO aplicada a Supabase.

## Hallazgo confirmado por consulta de metadatos (sin acceder a familias)

En Supabase Education Marketplace (PostgreSQL 17.6), las tablas `public.saved_searches`, `public.saved_search_matches` y `public.user_marketplace_preferences` conceden al rol `anon` y al rol `authenticated` todos los privilegios de tabla, incluidos `TRUNCATE`, `REFERENCES`, `TRIGGER` y `MAINTAIN`. En las tablas `marketplace_alert_outbox`, `marketplace_postal_centroids` y `transactional_email_deliveries` los clientes **no** tienen esos cuatro permisos.

PostgreSQL no aplica RLS a `TRUNCATE` ni `REFERENCES`. La Data API ordinaria de Supabase no expone estas operaciones, y los roles de API no pueden autenticarse directamente a Postgres. Sin embargo, son privilegios SQL innecesarios y podrían ser utilizados por una función insegura o un contexto SQL que actuase con uno de esos roles. **No se ha confirmado explotación ni borrado de datos**.

Fuentes:
- PostgreSQL 17, Row Security Policies: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- Supabase, Securing your API: https://supabase.com/docs/guides/api/securing-your-api
- Supabase KB, default privileges of supabase_admin (4/11/2026): https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema-448af9

## Migración de mínimo privilegio, sin DML

`supabase/migrations/20261111083000_marketplace_revoke_client_table_wide_privileges.sql` ejecuta **únicamente**:

```sql
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLE public.saved_searches, public.saved_search_matches,
  public.user_marketplace_preferences
FROM anon, authenticated;
```

No toca `SELECT`, `INSERT`, `UPDATE` ni `DELETE`, conserva los permisos de `service_role` y `postgres`, y no cambia políticas RLS. Comprueba al finalizar que los 24 privilegios (3 tablas × 2 roles × 4 tipos) están desactivados.

## Control de seguimiento y rollback

El control `scripts/pilot-client-tablewide-privileges-preflight.sql` **no escribe nada** y debe dar **FAIL en producción hasta aplicar esta migración**, lo que evita dar una falsa aprobación. La regresión sobre PostgreSQL17 efímero ensaya el escenario anterior, los grants preservados, la idempotencia y una concesión indebida posterior.

Antes de un cambio real de permisos: copia restaurable y alcance de recuperación verificados, ejecución programada controlada, observación y registro de rollback. En caso de rollback aprobado de esta migración solamente (NO ejecutar sin análisis de causa):

```sql
GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLE public.saved_searches, public.saved_search_matches,
  public.user_marketplace_preferences
TO anon, authenticated;
```

Ese rollback **restablece un riesgo** y solo procede si la operación legítima y su impacto justifican un cambio. Debe evaluarse con el equipo de seguridad y el dueño del sistema.

**No activar los avisos**, no aplicar las cinco migraciones de alertas pendientes y mantener #375 abierta. Los anuncios DEMO permanecen intactos. La corrección de permisos no implica que el DR integral ya esté certificado.
