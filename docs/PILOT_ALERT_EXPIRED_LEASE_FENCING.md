# WETUDY — Fencing de leases expiradas en el recuperador

Incidencia matriz #375, 10/11/2026. Esta fase no aplica SQL a producción ni habilita envíos.

## Hallazgo

Tres operaciones del outbox comprobaban estado `processing` y `lease_token`, pero no siempre la hora de caducidad de la lease:
- `marketplace_alert_settle_outbox_v1` (marcar éxito o fallo);
- `marketplace_alert_requeue_progress_v1` (continuar página);
- `marketplace_alert_defer_readiness_v1` (esperar fotografías).

Si el proceso conservaba su token original y acababa **después** de caducar, aún podía alterar el trabajo antes de que otro worker renovase su token. El token correcto no basta cuando la lease ya ha vencido.

## Corrección

La migración `20261110231500_marketplace_alert_expired_lease_fencing.sql` conserva las tres firmas y los permisos service_role y exige simultáneamente `q.lease_until > now()` y `q.expires_at > now()` para completar, reencolar o aplazar. No modifica la duración, reintentos, cron, proveedor ni estética. Reutiliza las funciones anteriores conservando su lógica.

La regresión PostgreSQL17 ensaya los tres RPC con lease vencida y lease válida, más TTL caducado, y verifica privilegios. El SQL está **solo en GitHub**, no aplicado a Supabase; el worker sigue OFF.

## Despliegue coordinado

Esta migración puede aplicarse independientemente de las cuatro pendientes de idempotencia, pero solo tras preflight, backup/PITR y validación de firma/roles del entorno. No considerarla desplegada por el mero merge del repositorio. Verificar resultados y RLS antes/después; conservar los seis DEMO.

**Bloqueo #375 abierto:** migraciones aún pendientes, E2E autorizada, conciliación y costes reales.
