# WETUDY — PR553, comprobación del destinatario antes de enviar avisos
15/11/2026. Código y pruebas de flujo sintético, sin emails reales ni SQL.

En la API `/api/messages/send`, después de verificar pertenencia a la conversación y remitente, se consultan con service_role el título de anuncio, nombre del destinatario, nombre del remitente y registro Auth del destinatario. La versión anterior descartaba `error` de esas cuatro consultas: un fallo de PostgreSQL/Auth podía producir un aviso incompleto o un error 500 **después** de crear una notificación, con reintentos confusos.

Ahora se comprueban las cuatro respuestas y se aborta con HTTP 503, `Cache-Control: private,no-store` y token de log fijo antes de cualquier escritura de notificación o envío de email. El acceso a `recipientAuth.data` es opcional para ausencia legítima de correo. Se conservan las claves idempotentes para reintentos y no cambian los permisos de participación de #539.

Cinco pruebas runtime en el handler real TS con sesión/SQL/Auth sintéticos comprueban error de listing, perfil receptor, perfil emisor, Auth receptor, y envío válido. Los fallos deben producir cero notificaciones/correos. CI y preview obligatorios antes de fusionar. No se afirma entrega de correo real. Abierta general NO-GO (AMPA 0/3, DR integral pendiente).
