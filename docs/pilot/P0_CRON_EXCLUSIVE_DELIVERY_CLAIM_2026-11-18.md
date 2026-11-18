# WETUDY P0 — Reserva durable de email mensual (REVIEW ONLY)

Archivo: `scripts/p0_school_impact_cron_claim_candidate_review_only.sql`. **No ejecutar en Supabase sin autorización expresa.** No está bajo `supabase/migrations` ni la llama el cron actual. Se mantiene el piloto general **NO-GO**.

El mecanismo propuesto crea una tabla de claims de envío con `UNIQUE(subscription_id, period_key)` y una función de adquisición invocable exclusivamente por `service_role`. Bloquea la fila de la suscripción, verifica día, colegio, usuario, correo y marcador, centro activo y `school_admin`, y realiza `INSERT ... ON CONFLICT DO NOTHING`. Solo un proceso puede obtener la claim para un mes, incluso bajo llamadas concurrentes.

**Orden futuro obligatorio:** verificar identidad/email y rol en servidor → generar informe privado → revalidar destinatario, permiso y suscripción → adquirir claim de periodo → llamar al proveedor **una vez** → guardar `provider_message_id` y marcar envío; si el proveedor falla o se desconoce si aceptó el mensaje, mantener el claim en `claimed` para investigación, nunca liberarlo ni reintentar a ciegas.

**Limitaciones:** no puede garantizar simultáneamente el commit de PostgreSQL y la entrega de correo por un proveedor externo. Una respuesta ambigua requiere conciliación manual. No hay expiry automático, reintentos, actualizaciones de producción ni dato real de envío. Antes de activarlo, hay que revisar privacidad, CAS de marcador, idempotencia del proveedor, preflight/rollback, permisos, migración y pruebas PG17 con dos workers compitiendo.
