# WETUDY — PR556 · Primer mensaje verificado antes de escribir avisos

15/11/2026. El endpoint autenticado `/api/messages/send` ya comprobaba pertenencia a conversación, autoría del mensaje, perfiles y datos Auth; pero todavía escribía `createNotificationOnce` antes de consultar cuál era el primer mensaje del remitente. Si esa lectura fallaba, quedaba una notificación escrita aunque la API respondiera error, sin que se hubiera podido verificar si correspondía enviar el correo del primer mensaje.

Ahora consulta `firstMessage` mediante el cliente administrador **después** de comprobar participación y autoría, y **antes** de generar la notificación. Si la consulta falla, responde HTTP 503, `Cache-Control: private,no-store` y registra solo `message_first_message_lookup_failed`, sin detalles SQL ni efectos de aviso/correo. Conserva la idempotencia existente `message-received/<id>` y `first-message/<id>`.

Cuatro escenarios ejecutan el handler real con Supabase/Auth/correo ficticios: error de lectura con cero envíos, primer mensaje correcto, mensaje posterior sin reenviar email y error en escritura de notificación sin email. CI Critical contracts y preview Vercel exigidos para fusionar.

No se envían mensajes/correos reales, no se modifican grants, RLS ni datos de familias. Las pruebas sintéticas no acreditan las tres AMPA (0/3). Respaldos 17/11 y DR integral pendiente. NO-GO apertura.
