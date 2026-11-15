# WETUDY — PR545: privacidad de resumen de conversaciones en producción
15/11/2026. Port limitado de QA PR #526 a main, sin tocar permisos productivos.

El endpoint productivo `app/api/messages/conversation-summary/route.ts` aceptaba identificadores sin validación UUID, daba acceso a un cliente service_role para leer perfiles aun si la conversación devuelta no pertenecía al usuario, trataba errores de SQL/HTTP como ausencia de datos y no aplicaba `Cache-Control: private, no-store` al contenido del último mensaje. Tras el endurecimiento ACL, el título de un anuncio reservado o vendido también podía perderse por una lectura con rol público/auth.

La corrección ya revisada en QA valida UUID antes de consultas, exige participación explícita antes del cliente admin, lee únicamente el título del anuncio con admin una vez autorizada la conversación, mantiene la lectura de mensajes con RLS de sesión, trata fallos sin exponer contenido parcial y aplica private,no-store a todos los códigos de estado. Captura excepciones inesperadas con token constante.

Siete tests HTTP reales sobre el handler TypeScript con usuario, conversación, perfil y mensajes sintéticos; cuatro contratos adicionales verifican secuenciación de autorización, metadata y caché. CI Critical contracts + Vercel preview antes de fusionar. Sin acceso a conversaciones reales ni cambio de SQL. #245 0/3 AMPA, DR integral pendiente, permisos default internos Supabase fuera de alcance.
