# WETUDY — PR563 · Fallos de Auth distinguidos de sesiones cerradas en borradores
Fecha 15/11/2026. Cambio solo de control de errores de la API de borradores, sin SQL ni alteración de permisos.

El helper de `app/api/marketplace/listing-draft/route.ts` ignoraba el campo `error` de `supabase.auth.getUser()`; ante una avería del proveedor podía responder incorrectamente 401 o, si se recibía un usuario en caché junto a un error, continuar con `createAdminClient()` para leer/escribir/eliminar borradores. El cliente privilegiado solo debe crearse después de una verificación de usuario sin error.

Se encapsula `getUser` con resultado `{user, authFailed}`, capturando tanto `error` de Supabase como excepciones de red. GET/PUT/DELETE devuelven HTTP 503 privado no-cache cuando Auth falla, antes de crear ningún cliente privilegiado, y siguen devolviendo 401 si no hay usuario y Auth funciona. No se reflejan mensajes internos al navegador ni se registra información identificable.

Se extiende la suite runtime de handlers existente con **seis escenarios nuevos**: en GET, PUT y DELETE simular un resultado `error` acompañado por usuario obsoleto y una excepción total de Auth. Se exige 503, `private,no-store` y cero admin accesses. Se conservan las pruebas de invitado 401 y los controles anteriores de integridad.

Sin sesiones reales de familias ni cambios de datos productivos; E2E completo, DR integral y 3 AMPA (0/3) siguen pendientes. NO-GO; respaldos 17/11.
