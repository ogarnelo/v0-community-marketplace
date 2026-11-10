# WETUDY — Puerta de revisión cuando falla el recibo histórico

Fecha: 10/11/2026. Incidencia P0 #375.

## Carrera cerrada en este cambio
La nueva vía protegida por doble bandera envía mediante una intención duradera y, cuando recibe un ID del proveedor, intenta crear una fila de compatibilidad en `transactional_email_deliveries`. Antes, si esa escritura fallaba después de que el proveedor aceptase el correo, se lanzaba un error genérico. El worker podía consumir sus reintentos y terminar en `failed`, mientras el correo ya constaba aceptado en la tabla de intenciones.

Ahora, la función devuelve explícitamente `{sent:false,reason:"requires_reconciliation"}`. El matcher del worker convierte ese resultado en `email_outcome_ambiguous` y el worker utiliza la RPC `marketplace_alert_hold_for_review_v1` para pasar el trabajo a `review_required`, sin volver a intentar enviarlo. El código no marca `emailed_at`.

## Límites
Este mecanismo depende de que las migraciones #377 y #382 estén aplicadas y de ambas banderas. No habilita ningún worker ni cron. La política de conciliación operacional y la E2E auténtica siguen pendientes; la intención aceptada no es un comprobante de entrega al destinatario.

Es importante conservar evidencia si una escritura de recibo falla. No se imprime contenido del error SQL ni correo/CP. El flujo ordinario del vendedor, que utiliza el envío anterior, no se modifica.
