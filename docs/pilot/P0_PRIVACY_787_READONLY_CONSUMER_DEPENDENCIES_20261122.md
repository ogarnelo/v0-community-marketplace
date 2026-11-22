# WETUDY P0 — Estado comprobado del bloqueo #787 (22-11-2026)

**Ámbito:** comprobaciones de catálogo de **solo lectura**, referidas al proyecto Supabase `jpsljmakoscqevssimtk`. No es consentimiento de revocación ni demuestra ausencia de consumidores externos. [PR #787](https://github.com/ogarnelo/v0-community-marketplace/pull/787) permanece **DRAFT y NO MERGE**. Ver las atestaciones en esa rama: `docs/pilot/ANON_FIVE_TABLE_CONSUMER_ATTESTATION_2026-11-20.json` y `docs/pilot/ANON_SELECT_FIVE_TABLE_ROLLBACK_ACCEPTANCE_2026-11-20.md`.

## Matriz real, sin alterar permisos

| Tabla | anon SELECT | anon INSERT/UPDATE/DELETE | anon MAINTAIN | RLS | políticas anon/PUBLIC | authenticated SELECT | service_role SELECT |
|---|---|---|---|---|---|---|---|
| agreements | Sí | No | Sí | Sí | 0 | Sí | Sí |
| demand_requests | Sí | Sí | No | Sí | 0 | Sí | Sí |
| profiles | Sí | Sí | No | Sí | 0 | Sí | Sí |
| saved_searches | Sí | Sí | No | Sí | 0 | Sí | Sí |
| schools | Sí | Sí | No | Sí | 0 | Sí | Sí |

Los GRANT a nivel tabla no significan lectura de filas anónimas con RLS ni autorizan cambiar políticas. `MAINTAIN` en agreements y DML heredados son riesgos de permisos **separados**, no parte de la propuesta selectiva #787.

## Dependencias reales de vistas (pg_depend + pg_options_to_table)

- `public.demand_opportunities_30d` depende de `public.demand_requests`. `security_invoker=true` y **anon tiene SELECT a la vista**. La retirada del SELECT a la tabla subyacente puede convertir solicitudes invitadas a errores de permisos; no afirmar que no existen consumidores remotos.
- `public.saved_search_demand_summary` depende de `public.saved_searches`. `security_invoker=true`, **anon NO tiene SELECT a la vista**; authenticated y service_role sí. Por tanto, no es comparable al primer caso como vía directa anónima, aunque requiere revisar consumidores autenticados y funciones indirectas.
- El inventario anterior es de dependencias directas de vistas del catálogo, **no** un inventario suficiente de RPC, GraphQL, Realtime, clientes móviles, SDK ajenos, materializadas, clientes offline o aplicaciones externas.

## Condiciones para pasar de DRAFT a propuesta de ejecución

Se mantienen explícitamente **PENDIENTES**:
- Inventario/atestación firmada por propietario de consumidores web, móvil, automatizaciones, integraciones ajenas y builds antiguos, con revisión específica de `demand_opportunities_30d`.
- Ensayo E2E representativo y consentimiento de revisores de seguridad independientes; no extrapolar PG17/PostgREST local a todos los clientes.
- Snapshot exacto del estado de grants productivos (incluye PUBLIC y columnas) y rollback apto para ese snapshot, con responsables, señales de reversión y aceptación formal.
- Autorización de producción diferenciada para cualquier REVOKE, y revisión independiente de los DML/MAINTAIN heredados.

**No se ha ejecutado ningún `REVOKE`, `GRANT`, DDL, DML o cambio RLS en esta investigación. No activar piloto.** La siguiente acción externa útil es obtener y validar las atestaciones; si no están disponibles, #787 sigue bloqueada y se prioriza otro frente sin permisos productivos.

## Evidencia reproducible de catálogo

```sql
-- READ ONLY
WITH target(name) AS (
 SELECT unnest(ARRAY['agreements','demand_requests','profiles','saved_searches','schools'])
)
SELECT t.name,
 has_table_privilege('anon',format('public.%I',t.name),'SELECT') AS anon_select,
 has_table_privilege('anon',format('public.%I',t.name),'INSERT') AS anon_insert,
 has_table_privilege('anon',format('public.%I',t.name),'UPDATE') AS anon_update,
 has_table_privilege('anon',format('public.%I',t.name),'DELETE') AS anon_delete,
 has_table_privilege('anon',format('public.%I',t.name),'MAINTAIN') AS anon_maintain,
 c.relrowsecurity AS rls
FROM target t JOIN pg_class c ON c.oid=format('public.%I',t.name)::regclass;

SELECT c.relname,
 coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions)
            WHERE option_name='security_invoker'),'false') AS security_invoker,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
 AND c.relname IN ('demand_opportunities_30d','saved_search_demand_summary');
```

**Referencia de continuidad:** `docs/pilot/WETUDY_START_HERE_CONTINUIDAD.md` y [#767](https://github.com/ogarnelo/v0-community-marketplace/issues/767).
