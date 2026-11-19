# WETUDY · Registro de migraciones P0 aplicadas — 19/11/2026

**Autorización:** «Aplica las migraciones avanza»; se interpreta limitada a candidatas #681 y #682 previamente anunciadas; **NO autoriza** activar checkout público, emails reales, pilotos generales ni cambios destructivos.

**Proyecto remoto:** Education Marketplace · `jpsljmakoscqevssimtk` · PostgreSQL 17.6. `VM Copilot` **no se ha modificado**.

## Ejecución y rastreo

1. `20261119081526` / `p0_buy_now_atomic_rpc_dormant_20261119`: **SUCCESS**; `public.p0_buy_now_prepare_atomic_candidate`.
2. `20261119081627` / `p0_school_impact_durable_claim_dormant_20261119`: **SUCCESS**; tabla `public.p0_school_impact_dispatch_claims_candidate` y funciones `p0_school_impact_claim_candidate`, `p0_school_impact_ack_candidate`.
3. Auditoría postflight con `pg_proc`, `has_function_privilege`, `pg_class.relrowsecurity`, `pg_constraint`, `has_table_privilege`, `supabase_migrations`: **tres RPC SECURITY INVOKER, service_role EXECUTE, anon/authenticated NO EXECUTE, tabla claims RLS ON y SELECT cliente denegado**.
4. Tabla claims: **0 filas**; una restricción UNIQUE(subscription_id,period_key).
5. Los permisos ordinarios anteriores permanecen como estaban; no se ha cambiado el catálogo de grants preexistente.

## Diferencias críticas frente a los candidatos REVIEW ONLY

El SQL de PR #681 estaba elaborado como **candidato**, no se ejecutó literalmente. Se corrigió `payment_intents.amount` para guardar `p_expected_price` (precio del artículo) y registrar aparte `metadata.total_buyer_amount`; `platform_fee_amount` se igualó a `p_buyer_fee`. Se prohíbe el envío con tarifa cero y el cobro de portes en recogida. No cambia el importe del producto ni realiza cargos Stripe.

Se respetaron los controles RLS, privilegios, bloqueos y unicidad del candidato #682. En los archivos ejecutados se quitó el par `BEGIN; ... COMMIT;` externo porque Supabase `apply_migration` gestiona la transacción; cada ejecución incluye un guard SQL adicional que aborta si falla la seguridad.

Copias de auditoría de la sentencia aplicada, **no archivos de autodespliegue**:
- `docs/pilot/sql/p0_buy_now_atomic_rpc_dormant_applied_20261119.sql`
- `docs/pilot/sql/p0_school_impact_durable_claim_dormant_applied_20261119.sql`

## Gates y limitaciones

- **DORMANT**: no se ha modificado `/api/offers/buy-now` ni `/api/cron/school-impact-reports`. Las dos rutas existentes continúan con sus riesgos transaccionales preexistentes, y la presencia de objetos SQL por sí sola **no elimina** esos riesgos.
- `service_role` tiene permiso para usar las funciones; el camino de activación futuro requiere autenticación de usuario y controles de propiedad/pertenencia en servidor, pruebas reales de rollback y concurrencia, simulación con dos colegios, protección frente a fallos de Stripe/email, y banderas de activación explícitas.
- El advisory nuevo `rls_enabled_no_policy` en claims es intencionado: no se conceden políticas a clientes. Sigue un WARN previo `auth_leaked_password_protection` sin cambios.
- No se ha generado ningún pago, reserva real, envío de email ni etiqueta; no hubo eliminación de datos existentes.
- **Piloto general NO-GO**. Prohibido activar o enviar por el mero hecho de aplicar estas migraciones.

## Verificación futura

Consultar `supabase_migrations.schema_migrations` y los metadatos de `pg_proc`/ACL antes de desplegar adaptadores. No repetir estas sentencias sobre producción por copiar estos ficheros. Si hay un despliegue de integración, exigir prueba de RLS y rollback en PostgreSQL 17 aislado antes de cualquier activación.
