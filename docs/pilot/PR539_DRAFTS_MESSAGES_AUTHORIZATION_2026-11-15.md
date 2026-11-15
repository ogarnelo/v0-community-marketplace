# WETUDY — PR539: seguridad de borradores y avisos de primer mensaje
Fecha: 15/11/2026; rama main, sin DDL/DML productivo.

## Problema 1: API de borradores
`app/api/marketplace/listing-draft/route.ts` exponía `error.message` de consultas privilegiadas y Storage en GET/PUT/DELETE, sin Cache-Control privado explícito. También ignoraba errores en las lecturas previas del borrador y podía continuar a eliminar fotografías o sobrescribir sin conocer su estado. La corrección usa private,no-store en todas las respuestas, errores genéricos, logs de código fijo y aborta 503 si falla la lectura de estado previa a PUT/DELETE. Mantiene límites 8 fotos, 32 KB, prefijos userId y limpieza legítima.

## Problema 2: API de notificación de mensajes
`app/api/messages/send/route.ts` leía conversación y mensaje con service_role antes de comprobar pertenencia. Ahora valida UUID, obtiene conversación con cliente de sesión protegido por RLS, comprueba participante y solo entonces crea cliente privilegiado para verificar el mensaje. Devuelve 404 genérico al ajeno, respuestas privadas no-cache y 503 sin detalles SQL al fallar lecturas. El catch general deja de reflejar excepciones y de registrar errores privados del proveedor de correo. Se mantienen claves de idempotencia de notificaciones y email del primer mensaje.

## Verificación
`__tests__/launch/pilot-private-draft-message-api-runtime.test.mjs`: ocho escenarios contra handlers reales TS transpileModule con datos sintéticos, mock de usuario, acceso y errores. Ejecutados por Critical contracts en toda PR. No prueba entrega real del correo, ni sesión con familia real. No se alteran permisos SQL ni tablas.
## Seguimiento
La migración productiva 48 tablas está aplicada (version 20261115190150) y 16 default grants de postgres retirados (version 20261115190257). Siguen pendientes 16 default grants de supabase_admin (requiere operador legitimado) y 18 MAINTAIN de 14 tablas fuera de autorización. #245 0/3 AMPA, prueba E2E auténtica pendiente, DR evidencia previa parcial, respaldos reservados al 17/11. NO-GO apertura.
