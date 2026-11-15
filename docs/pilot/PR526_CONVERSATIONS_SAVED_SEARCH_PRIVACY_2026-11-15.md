# WETUDY — PR526: privacidad de resúmenes de conversación y avisos de búsquedas guardadas

15/11/2026. Rama QA: `integration/pilot-anon-privacy-20261114`. Sin modificaciones en main, Vercel de producción ni base de datos de producción.

## Hallazgo A: conversación privada
`app/api/messages/conversation-summary/route.ts` devolvía resúmenes con texto del último mensaje y nombre del interlocutor sin encabezado explícito contra caché. Además, un fallo en lectura privilegiada de anuncio/perfil o lectura del último mensaje se ignoraba, y podía devolver un 200 parcialmente ficticio. Se añade `Cache-Control: private, no-store` en todas las respuestas (éxito y errores); comprobación de UUID antes de consultas; respuesta 503 genérica ante cualquier fallo de lectura. Se mantiene comprobación de participante **antes** de crear cliente service_role y respuesta 404 para no participantes.

Confirmado por consulta sólo catálogo a Supabase que `public.conversations.id` es UUID; no se leyeron conversaciones ni datos de familias.

## Hallazgo B: alertas de búsquedas guardadas
`app/api/marketplace/listings/match-saved-searches/route.ts` registraba el objeto de error completo en el catch superior, y devolvía `error?.message` al navegador. El flujo procesa filtros, CP y destinatarios, por lo que se elimina la exposición de diagnósticos SQL/proveedor. Los logs de atribución de demanda, correo y fallo global son ahora únicamente identificadores constantes. El error 500 global es genérico y `private,no-store`. Se conservan controles actuales de autorización, lease del trabajador, idempotencia y estados de entrega.

## Verificación y límite
- Seis escenarios de ejecución del handler de resúmenes mediante Node + TypeScript transpileModule y dobles sintéticos: anónimo, UUID inválido, no participante, error de consulta, acceso legítimo y fallos de lectura.
- Prueba de contrato contra regresión de tres posiciones de logs privilegiados y reflexión de `error.message` del matcher.
- Ambos grupos añadidos al job `Critical contracts`. El workflow local Next+Auth+PostgREST se activa al cambiar `app/api/messages/**`, según PR525, pero no prueba automáticamente el matcher completo end-to-end.
- No certificar privacidad productiva por CI; #447 sigue NO-GO hasta corrección ACL autorizada y E2E real.

## Seguimiento
0/3 AMPA reales aceptadas (#245). Recuperación parcial #455 ya acreditada; la decisión de custodiar respaldos el 17/11 no se reabre en esta tanda. La fecha objetivo 26/11 es condicional.
