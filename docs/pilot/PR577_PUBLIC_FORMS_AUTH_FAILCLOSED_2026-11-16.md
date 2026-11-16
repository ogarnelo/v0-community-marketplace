# PR577 — Contrato de invitado de altas institucionales y soporte; atribución de contacto

16/11/2026. En `POST /api/support/tickets` y `POST /api/schools/requests`, **la solicitud pública debe seguir disponible para invitados**: ausencia de sesión => visitante (no 401). Avería real o excepción de Auth => 503 sin permitir que un usuario residual se utilice como identidad ni que se escriba en las tablas de destino. PII y errores privados llevan `Cache-Control: private, no-store`; excepciones no reflejan detalles de backend.

En `POST /api/demand/attribute-contact`, endpoint autenticado: invitado=>401 y caída Auth=>503. La identidad solo se utiliza tras Auth exitosa; fallo en atributo no envía detalles internos al navegador.

**21 pruebas runtime**: 18 escenarios de Auth, 2 validaciones normales sin SQL (formularios) y 1 atribución con usuario legítimo. Sin llamadas a Supabase real, sin envíos de correos y sin cambios de tablas, permisos, respaldos ni activación del piloto. NO-GO pendiente de E2E/DR/3 AMPA.
