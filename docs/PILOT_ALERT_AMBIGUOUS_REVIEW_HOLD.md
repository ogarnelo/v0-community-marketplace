# Wetudy — Cuarentena de correos inciertos

Vinculado a #375. Esta PR agrega la última etapa de seguridad del recuperador pero **no lo activa**.

Un HTTP 409 genérico no autoriza cuarentena: la respuesta del comparador debe indicar literalmente review_required: true y reason: email_outcome_ambiguous. Solo la fase de entrega del worker con las dos banderas puede emitirla. El worker llama a marketplace_alert_hold_for_review_v1 con su token de lease vigente.

El nuevo estado de outbox review_required no se reclama por marketplace_alert_claim_outbox_v1 (que solo admite pending/processing); no puede reencolarse ni completarse por una lease antigua. La RPC marketplace_alert_review_count_v1 ofrece solo un recuento agregado al rol de servicio. No guarda email, CP ni colegio.

**Requiere migraciones aplicadas en orden antes de usarlo:** PR #377 (marketplace_alert_email_intents) y esta migración de cuarentena. Los tests aislados no prueban que existan en Supabase producción. La interfaz para revisar/conciliar estados inciertos aún es manual y pendiente; la incidencia #375 se mantiene abierta.

Antes de cualquier activación: advisors, revisión de esquemas existentes, E2E con buzones QA autorizados, prueba de pérdida de conexión, comportamiento en reintentos y comprobación de costes y rollback. Mantener las dos banderas ausentes, ningún cron nuevo, colegios inactivos y seis anuncios DEMO sin cambios.