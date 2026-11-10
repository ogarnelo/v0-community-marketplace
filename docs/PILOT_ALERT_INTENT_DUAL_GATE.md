# WETUDY — Integración de recuperación con doble bandera (PR #381)

Estado al 10/11/2026: **código preparado, recuperador y segundo canal desactivados**. Seguimiento P0: #375.

## Autorización técnica

Solo un **worker interno firmado con CRON_SECRET**, token de lease no caducado, fase `deliver`, con `WETUDY_ALERT_OUTBOX_ENABLED=true` y **además** `WETUDY_ALERT_INTENT_DELIVERY_ENABLED=true`, podrá usar la ruta con intención persistente. El envío habitual del vendedor sigue pasando por `sendTransactionalEmailOnce` y conserva su HTML actual. Ambas variables están ausentes de Vercel según la última inspección, por lo que NO se habilita esta vía en este despliegue.

El nuevo flujo comprueba primero un recibo de la versión histórica, luego el estado de supresión por hash; crea el mensaje con la plantilla existente una sola vez, reserva la huella exacta y usa los mismos bytes en el transporte Resend. Si el resultado fue aceptado, persiste un recibo compatible con el sistema anterior ANTES de marcar `emailed_at`. Errores, respuestas inciertas y conflictos de payload **no marcan envío**.

## Riesgos P0 que continúan bloqueando la activación

1. **SQL ausente en producción:** aplicar y verificar migración de intenciones #377 mediante procedimiento controlado y revisar Supabase advisors. No habilitar la segunda bandera antes.
2. **Resultado ambiguo:** la ruta devuelve error a su worker y este reintentará el *trabajo* hasta su máximo. La intención no reenvía el mismo correo, pero falta una fase de conciliación y estado operativo específico sin consumir intentos de cola. Los jobs pueden acabar en estado failed.
3. **Carrera entre flujo nuevo y envío heredado:** el envío habitual no toma reserva de intención. Las claves del proveedor ofrecen protección limitada a 24 h; hacer una E2E concurrente y definir migración atómica.
4. **Cambios de preferencias:** el re-chequeo colegio/CP/preferencias sigue antes del proveedor, pero no elimina la ventana externa de carrera.
5. **E2E y costes:** ejecutar QA con buzones adultos autorizados y datos sintéticos; medir Resend, Vercel y DB y preparar rollback.

**No programar cron, no cambiar banderas, no enviar correos a familias, no activar AMPA/colegios, ni tocar seis anuncios DEMO.** Esta PR no cierra el issue #375.
