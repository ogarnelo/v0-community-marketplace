# WETUDY — Replays de intenciones aceptadas con recibo verificable

Fecha: 2026-11-10. Incidencia P0 #375.

## Problema corregido

Cuando una intención de envío ya constaba como `accepted`, el adaptador evitaba contactar de nuevo con Resend, pero devolvía `already_accepted` **sin el ID del mensaje**. Si el recibo legado no existía, el puente podía guardar `provider_message_id = NULL` y declarar éxito. La falta de ID impide correlacionar la aceptación con el proveedor.

Ahora el adaptador consulta el `provider_message_id` **de la intención previamente aceptada**, usando el cliente de servicio. Solamente devuelve `already_accepted` cuando el recibo es legible y tiene un ID no vacío. Si está ausente o falla la consulta, devuelve `requires_reconciliation`; el worker aislado pone el trabajo en revisión sin correo ni éxito ficticio.

Como defensa adicional, el puente `sendGatedMarketplaceAlertWithIntent` exige que **tanto `accepted` como `already_accepted` incluyan un identificador válido** antes de crear el recibo histórico y marcar el envío.

## Verificaciones

Tests Node de la función real de reserva y de la composición: replays exitosos mantienen el ID, un recibo inexistente o un error de DB no reenvía y queda bloqueado. Test funcional TypeScript de compatibilidad: recibo nulo no produce `sent:true`, y recibo válido sí puentea el ID. No hay llamadas externas: proveedor y Supabase son mocks.

Este cambio no añade migraciones, cron, variables, datos de familia ni correos. El envío cotidiano del vendedor permanece en la vía anterior; la integración protegida sigue inaccesible con las dos banderas ausentes.

**Bloqueos sin resolver:** cinco migraciones en Supabase producción; restauración/PITR sin verificar; conciliación operativa y E2E autorizada. Mantener la incidencia #375 abierta.
