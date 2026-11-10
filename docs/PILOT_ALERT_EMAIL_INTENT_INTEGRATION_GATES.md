# WETUDY — Puertas de integración del adaptador de correos (PR #378)

Estado: **módulo aislado, NO conectado al worker**. Incidencia matriz: #375.

## Qué incorpora esta PR

`lib/marketplace/alert-email-intent-delivery.mjs` reutiliza las RPC de la PR #377:
`marketplace_alert_email_prepare_v1`, `_begin_v1`, `_accept_v1` y `_ambiguous_v1`.

La identidad `saved-search-match/{match.id}` se reserva con SHA-256 del **cuerpo serializado exacto que recibiría el proveedor**. La API solamente permite un primer paso de `prepared` a `sending`; un fallo posterior queda bloqueado y exige conciliación. La huella no guarda en la BD el correo, el CP ni el cuerpo.

El adaptador todavía NO está importado en `match-saved-searches/route.ts`. Publicarlo no habilita envíos ni exige la nueva tabla en producción; las pruebas usan dobles aislados.

## Bloqueos específicos antes de conectarlo

1. **Compatibilidad histórica:** consultar `transactional_email_deliveries` antes de preparar nuevas intenciones, para no reenviar un evento ya aceptado con el mecanismo antiguo. No fingir aceptación a partir de una respuesta ambigua.
2. **Payload canónico:** generar UNA sola vez el objeto Resend exacto (de: remitente; to; asunto; HTML; texto; adjuntos), serializarlo y entregar esos **mismos bytes** a la huella y al `fetch`. No renderizar por separado después de obtener la reserva. Evitar almacenar el cuerpo personal en la tabla.
3. **Prerequisitos:** la migración de PR #377 aún debe verificarse/aplicarse en el entorno adecuado antes de llamar a las RPC. Exigir `service_role` solo en servidor, sin nuevas autorizaciones de cliente.
4. **Resultados:** marcar `accepted` únicamente con `provider_message_id` validado, o crear un protocolo explícito para proveedores que no devuelvan ID. `sending/ambiguous` **no** equivale a enviado ni a salto terminal.
5. **Outbox:** cuando haya ambigüedad, marcar trabajo como bloqueado/revisión en vez de consumir reintentos o completar falsamente el anuncio. No utilizar un 503 ilimitado que agote trabajos sin visibilidad.
6. **Preferencias vivas:** volver a comprobar opt-out, CP, colegio y disponibilidad del anuncio justo antes de iniciar un nuevo intento; documentar la carrera residual con la API externa.
7. **Conciliación:** proceso manual restringido, auditable, sin reenvío por defecto ni exposición de direcciones; analizar qué evidencia puede obtenerse de Resend dentro y después de sus 24 h de idempotencia.
8. **Pruebas:** concurrencia Postgres real, recepción exitosa seguida de caída antes del recibo, timeout, 409 de payload, vencimientos 24/48 h, reinicio de worker y E2E con buzones QA adultos autorizados.
9. **Costes/observabilidad:** comparar recuentos agregados en el health privado y coste medido en Vercel/Supabase/Resend; sin facturas reales no asignar importes cobrados.

**No encender** `WETUDY_ALERT_OUTBOX_ENABLED`, no crear cron, no enviar mails reales, no activar colegios ni alterar los seis DEMO hasta superar estas puertas.
