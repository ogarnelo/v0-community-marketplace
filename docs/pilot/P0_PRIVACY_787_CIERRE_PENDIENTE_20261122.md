# WETUDY — Acta de cierre pendiente del bloque #787

> **ACTUALIZACIÓN VIGENTE 22/11/2026:** por autorización expresa del propietario, [PR #787](https://github.com/ogarnelo/v0-community-marketplace/pull/787) se **cerró SIN MERGE** (cierre administrativo, no remediación). La retirada de `anon SELECT` en cinco tablas no se ha efectuado y queda **pendiente de seguridad** en [issue #804](https://github.com/ogarnelo/v0-community-marketplace/issues/804); revisión independiente, firmas y rollback productivo siguen como condiciones de reactivación. El resto de esta acta documenta el bloqueo **anterior a la decisión** y conserva su valor histórico, pero no debe interpretarse como que la PR sigue abierta. Repriorización permitida por decisión explícita. Piloto NO-GO.

**Fecha:** 22/11/2026 · **Tipo:** bloqueo externo verificable, no una nueva auditoría repetida. [PR #787](https://github.com/ogarnelo/v0-community-marketplace/pull/787) / [seguimiento #767](https://github.com/ogarnelo/v0-community-marketplace/issues/767).

## Decisión de estado

**BLOQUE GENERAL P0 PRIVACIDAD = ABIERTO / BLOQUEADO EXTERNAMENTE.** Los ensayos técnicos locales están cerrados, no el permiso de producción. El propietario ha exigido reiteradamente **cerrar bloques antes de cambiar de frente**: la regla está ahora en `AGENTS.md`. No se puede declarar #787 cerrado ni saltar por iniciativa propia a #227, WhatsApp, IA, R2, etc. Una repriorización por bloqueo externo requiere decisión explícita del responsable.

## Alcance congelado

Propuesta bajo revisión: retirar exclusivamente `SELECT` del rol `anon` en `public.agreements`, `public.demand_requests`, `public.profiles`, `public.saved_searches`, `public.schools`, sin alterar RLS, grants de `authenticated`/`service_role`, privilegios heredados distintos de SELECT ni políticas. `#787` tiene 98 commits y no debe mergearse sin revisión de solapamientos y rebase sobre main. La revocación tampoco está autorizada.

### Evidencias cerradas técnicamente, NO repetir

- Ensayos PG17/PostgREST con JWT sintéticos en tres fases (permisos antes → revocación local → rollback): cliente invitado 200/[] → error 42501 → 200/[]; autenticados aislados entre usuarios.
- Ensayo Next.js/Chromium SSR local y Realtime WebSocket WAL local; rollback de matriz 5 tablas × 3 roles × 8 privilegios + RLS.
- Pruebas CI satisfactoriamente registradas en la descripción del HEAD histórico `8a0567b09e82b59829b9a19552ce45b61127a67b`, pero repetir **solo** si se modifica ese HEAD o cambia evidencia crítica.
- Auditoría real read-only 22/11: cinco `anon SELECT`, RLS activo, cero políticas anon/PUBLIC; heredados: cuatro tablas anon DML, `agreements` anon MAINTAIN; permisos efectivos de fila siguen dependiendo de RLS.
- Vistas `security_invoker=true`: `demand_opportunities_30d` depende de `demand_requests` y permite `anon SELECT` directamente; `saved_search_demand_summary` depende de `saved_searches` pero no tiene `anon SELECT`. Archivo principal: `P0_PRIVACY_787_READONLY_CONSUMER_DEPENDENCIES_20261122.md`.

## Condiciones externas que impiden un cierre definitivo

Manifest `docs/pilot/ANON_FIVE_TABLE_CONSUMER_ATTESTATION_2026-11-20.json`, **en rama de #787** (no confundir con main), marca `external_consumer_gate=BLOCKED`, `production_permission_change_authorized=false`, **ocho categorías** de consumidores con `disposition=pending`, `responsible_owner_signoff_at_utc=null`, y **ocho señales** de `independent_discovery=false`.

| Falta externa | Evidencia exigida | Responsable antes de levantar bloqueo |
|---|---|---|
| Consumidores web actuales, móviles y builds antiguos | Inventario firmado de uso de Data API de invitados y JWTs, incluidos clientes inactivos | Propietario/operador de cada integración |
| Automatizaciones, scripts offline y proveedores | Inventario y confirmación de clientes no inventariables en código | Propietario técnico |
| Vistas, RPC, GraphQL y Realtime | Validación del impacto de `demand_opportunities_30d` y demás rutas indirectas | Operador y responsables de clientes |
| Ensayos funcionales representativos | E2E real privado de familia/admin y consumidores externos afectados, sin abrir el piloto general | Responsable de QA / clientes |
| Rollback de ACL productivas | Snapshot exacto de permisos RLS/relacl/attacl/public/membresías y procedimiento de restauración específica, con señales/owner de rollback | Responsable de DB |
| Análisis de grants DML/MAINTAIN heredados | Revisión de riesgo distinta del retiro SELECT; mantener alcance acotado | Revisor de seguridad independiente |
| Revisión final y cambio productivo | Aprobación escrita de experto independiente y autorización específica para `REVOKE` | Responsable de seguridad y propietario WETUDY |

**No se deben inventar firmas, declarar ausencia de aplicaciones externas desde logs limitados ni activar una prueba de producción a falta de responsables.**

## Próximo avance válido en este mismo bloque

Solicitar **una sola intervención al propietario** para confirmar quién puede firmar el inventario de clientes externos, antiguos, móviles y automatizaciones, y quién puede ser revisor independiente del rollback. Con nombres/responsabilidades y enlaces de evidencia, completar las atestaciones reales en #787, analizar gaps y volver a decidir **GO/NO-GO**. Hasta entonces no ejecutar REVOKE, no fusionar #787 y no abrir otro bloque sin repriorización explícita.

**Estado de la auditoría de este turno:** solo catálogos y repositorio, ninguna mutación de permisos, RLS, datos, flags, Stripe o usuarios. No se ha instalado nada en Supabase ni abierto el piloto.

## Protocolo de salida

Si se reciben las firmas y pruebas: validar snapshot preflight productivo, preparar SQL autorizado y rollback exacto, aprobación independiente, CI del HEAD final, merge/despliegue/postflight y actualización del issue #767 + maestro histórico. Solo declarar **CERRADO DEFINITIVAMENTE** tras completar todo.

Si las firmas o consumidores externos no pueden identificarse ahora: conservar `BLOQUEADO EXTERNAMENTE / ABIERTO`; solicitar decisión explícita de diferir #787 hasta piloto o repriorizar. No cambiar automáticamente de frente por un “go”.
