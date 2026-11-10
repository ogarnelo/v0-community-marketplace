# WETUDY — Compatibilidad histórica y payload canónico de Resend

**Fecha:** 10-11-2026. **Bloqueo:** #375. **Estado:** implementado en módulo aislado, sin conexión al recuperador.

## Cambios de este incremento

1. `deliverWithIntent` comprueba **primero** `transactional_email_deliveries` para el mismo `event_key`. Si el envío antiguo consta como registrado, no reserva otra intención ni invoca Resend. Si la lectura falla, no envía.
2. `prepareResendWirePayload` produce los mismos bytes JSON (orden de campos, dirección en array y `content_type`) que el formato actual del remitente `sendBrandedEmail`. El SHA-256 se deriva exactamente de esta cadena; no se persiste ni devuelve el contenido.
3. `sendPreparedResendPayload` envía **la cadena recibida**, sin releer títulos ni rehacer HTML. El recibo debe contener ID; un 409, timeout o recibo incompleto se considera error sin registrar contenido privado.
4. Los dobles inyectados comprueban correos ya enviados, errores de consulta, cambios de título/HTML, bytes idénticos y error del proveedor. Sin red ni buzones reales.

## Precaución

Estos módulos **no están importados en** `match-saved-searches/route.ts`. La comprobación histórica evita reenvíos *secuenciales* de recibos ya registrados; **no** evita por sí sola una carrera simultánea con el flujo antiguo. La conexión real requiere migrar el punto de envío a un único camino, auditar carreras, comprobar la existencia de las RPC en el entorno autorizado, disponer de manejo de `ambiguous` sin reintento y completar E2E.

La tabla de intenciones de la PR #377 todavía no debe suponerse aplicada. No activar `WETUDY_ALERT_OUTBOX_ENABLED`, no programar cron ni utilizar colegios, anuncios o correos reales en QA sin autorización.
