# WETUDY — Unicidad del identificador de mensaje Resend

**Fecha:** 10/11/2026. Incidencia P0: #375. Esta PR no activa los avisos y no modifica Supabase de producción.

## Invariante

Un `provider_message_id` del proveedor no puede certificar dos eventos diferentes. La nueva migración añade un índice UNIQUE parcial sobre `marketplace_alert_email_intents(provider_message_id)`, para los ID no nulos. Se aplica tanto a la confirmación automática de la intención como a la conciliación manual del operador.

Las pruebas en PostgreSQL 17 desechable cubren:
- dos eventos distintos intentan utilizar el mismo ID del proveedor: **el segundo falla**;
- la intención rechazada permanece en estado `sending` o `ambiguous`, sin reenviarse;
- un operador no puede reconciliar manualmente reutilizando el mismo ID;
- un ID distinto para el segundo evento sí puede confirmarse.

## Limitaciones y aplicación

La unicidad no demuestra la autenticidad de la evidencia y no garantiza la entrega final al destinatario. Por eso la revisión externa y la E2E siguen siendo necesarias.

**Orden de migraciones pendiente:** intenciones (#377), cuarentena (#382), conciliación manual (#386) y finalmente este índice. Antes de aplicarlo, verificar que no hay duplicados previos, revisar bloqueos de DDL, copia de seguridad/PITR y ejecutar el preflight. El índice se crea sin `CONCURRENTLY` porque forma parte de un despliegue coordinado con el worker OFF y tabla todavía ausente; no ejecutar sobre tablas pobladas con escrituras sin nueva revisión.

No añadir cron, no modificar las dos banderas y no cerrar #375.
