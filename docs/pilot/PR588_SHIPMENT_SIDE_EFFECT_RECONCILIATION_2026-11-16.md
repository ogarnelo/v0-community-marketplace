# PR588 · Conciliación explícita de efectos secundarios del transporte

16/11/2026. En `mark-dispatched` y `mark-delivered`, un cambio de estado válido ya no se declara `ok:true` si falla el registro de `shipment_events`. Se devuelve 503 con mensaje de conciliación; no se reintenta automáticamente la transición de estado (está protegida por CAS de estados), para no duplicar eventos.

En `mark-delivered` se intenta actualizar `payment_intents.metadata.delivered_at` incluso si falló la inserción del evento, y se comprueba fila afectada por `select('id').maybeSingle()`. Si falla cualquiera de los registros de auditoría o el metadato del pago, la respuesta exige reconciliación, no un falso OK. Un fallo de base al consultar el pago o actualizar estado produce 503, no 400. No existe atomicidad entre tablas: para garantizarla hará falta diseño y autorización SQL independiente.

**12 pruebas runtime** con respuestas simuladas (11 escenarios de transiciones, una comprobación de código), sin pagos ni envíos reales. Rama apilada sobre PR587, fusionar PR587 primero. No cambia los roles o feature gates, no ejecuta SQL ni abre piloto.
