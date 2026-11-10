# WETUDY — Conciliación manual de aceptación externa (P0 #375)

**Estado:** mecanismo de datos y pruebas aisladas, **no conectado a UI ni a envío**. La base Education Marketplace todavía no tiene las migraciones de intenciones y cuarentena, por lo que esta tercera migración NO debe aplicarse antes.

## Qué permite

Con evidencia independiente de Resend (API o panel), un operador autorizado puede registrar en la tabla de intenciones que un mensaje previamente **sending/ambiguous** fue aceptado. Exige `event_key`, un `provider_message_id` válido, la huella SHA-256 de la evidencia y un origen de verificación limitado a `resend_api` o `resend_dashboard`. Solo el rol de servicio puede ejecutar la función. La huella ayuda a auditar, pero **NO verifica por sí sola la autenticidad de la evidencia**. No guardar capturas ni direcciones de destinatarios en la base.

## Procedimiento permitido en un entorno QA autorizado

1. Mantener las dos banderas del recuperador OFF. Consultar únicamente los estados de intención y los contadores privados mediante el acceso administrativo autorizado.
2. Cuando exista un mensaje en estado ambiguo, confirmar por medios independientes el identificador de Resend y la correspondencia con el evento. Si no hay confirmación inequívoca, **NO conciliar como accepted**, NO reenviar y dejar el estado para revisión.
3. Aplicar la RPC de reconciliación solo con el identificador confirmado y una huella documental verificada. La RPC se niega a sobrescribir aceptaciones anteriores y no tiene ninguna transición `ambiguous -> prepared`.
4. La confirmación de intención **no** actualiza por sí sola `transactional_email_deliveries` ni `saved_search_matches.emailed_at`, y no reactiva un trabajo `review_required`. Son reconciliaciones operativas distintas pendientes de diseñar y probar. Por tanto, **no equivale a entregar la alerta ni a resolver la incidencia #375**.
5. Revisar los contadores agregados; no introducir identificadores de destinatario, CP, centro ni payload en logs o informes. Documentar la autorización de quien hizo la investigación fuera de la base, conforme a control de acceso.

## Invariantes y límites

- Requiere aplicar en orden las migraciones #377, #382 y esta, después de revisar backup/PITR, privilegios/RLS y resultado del preflight.
- No es seguro usar pruebas de PostgreSQL aisladas como prueba de despliegue o entrega real.
- La evidencia errónea de un operador privilegiado puede marcar una aceptación que nunca ocurrió; la base no puede contrastar de forma independiente con Resend. Hasta resolver la revisión operativa y la E2E, el worker permanece apagado.
- No se eliminan ni se sobrescriben los seis anuncios DEMO; ninguna cuenta/colegio se activa.
- No existen costes de envío creados por estas pruebas; los costes reales de servicios siguen sin medirse.

**Bloqueo #375 abierto.** Ningún cron o variable de activación debe habilitarse por esta PR.
