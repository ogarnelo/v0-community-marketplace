# WETUDY — Bloqueo P0 de idempotencia externa (Resend)

Fecha: 10/11/2026. Seguimiento: https://github.com/ogarnelo/v0-community-marketplace/issues/375.

## Evidencia confirmada y alcance

Resend documenta que la cabecera `Idempotency-Key` solo conserva el registro durante **24 horas** y que **la misma clave con payload distinto** ocasiona `409 invalid_idempotent_request`. Referencias: https://resend.com/changelog/idempotency-keys y https://resend.com/blog/engineering-idempotency-keys.

En el repositorio Wetudy, el outbox caduca a las **48 horas**. Los avisos usan la clave `saved-search-match/{match.id}`. El sistema consulta `transactional_email_deliveries`, después solicita el envío y **solo después** escribe el recibo local. El título del anuncio entra en asunto, texto y HTML y podría cambiar entre dos intentos. Son hechos del código; **no** acreditan por sí mismos que se hayan duplicado emails.

## Riesgos que impiden activar el worker

| Escenario | Comportamiento que puede producirse | Requisito antes de activar |
| --- | --- | --- |
| Envío aceptado, escritura local falla | Primer envío reconocido por proveedor pero sin recibo durable | Registrar intención/aclarar entrega ambigua |
| Reintento transcurridas 24 h | Resend podría aceptar otro correo con la misma clave | Política de recuperación que no asuma deduplicación ilimitada |
| Edición del anuncio entre intentos | `409 invalid_idempotent_request` | Captura inmutable del payload o protocolo de conciliación |
| Dos workers concurrentes | Ambos podrían ver ausencia de recibo antes de enviar | Exclusión en almacenamiento duradero, verificación de lease y pruebas de carrera |
| Familias cambian CP/colegio/opt-out entre consulta/envío | La revalidación puede quedar obsoleta en la ventana externa | E2E autorizada y aceptación explícita del riesgo residual |

## Plan de implementación en incrementos

1. **Sin cambios de runtime**: consolidar evidencia y tests de simulación; la batería `marketplace-alert-resend-retention-risk.test.mjs` muestra que las 24 h no cubren 48 h y que el payload mutable puede provocar 409.
2. Diseñar una reserva transaccional de envío por `event_key`, con estados `prepared / sending / accepted / ambiguous`, lease/fencing y un payload o huella inmutable. La reserva no debe marcar envío por adelantado como entregado.
3. Para estados ambiguos, conciliar por identificador de proveedor o, si no es comprobable, **detener el reenvío** y exponer contador de pendientes para revisión; no cambiar la clave de idempotencia arbitrariamente.
4. Validar vencimiento 24/48 h, errores 409, cortes de red, simultaneidad, revocación de preferencias y cierre de navegador con fixtures y cuentas QA adultas autorizadas.
5. Medir coste real de almacenamiento, consultas y envío en QA, revisar RLS y tener rollback antes de cualquier cambio de producción.

**Estado:** recuperador automático desactivado hasta completar P0. Sin cron nuevo, correos reales, activación de escuelas ni cambios estéticos.
