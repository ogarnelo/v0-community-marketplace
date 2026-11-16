# WETUDY — PR572 · El visitante sin sesión no es un error de infraestructura Auth
16/11/2026 · Corrección de regresión descubierta mediante smoke HTTP productivo tras PR571.

## Evidencia real
Sin cookies de sesión, `GET https://www.wetudy.com/api/marketplace/my-school` devolvió **HTTP 503** con JSON `No se pudo comprobar tu sesión`, donde el contrato de invitado exige **HTTP 401**. La documentación de Supabase Auth confirma que `getUser()` sin token devuelve `AuthSessionMissingError` y `user:null` (no es una caída del proveedor). Los tests sintéticos anteriores simulaban ausencia de usuario con `error:null`, por lo que no lo detectaron.

## Fix
En cinco rutas críticas que habían endurecido Auth (#563, #567, #569 y #571) diferenciar explícitamente:
- `AuthSessionMissingError` o código `session_not_found` => **401 privado**, jamás usar un user posiblemente obsoleto.
- Cualquier otro error de Auth => **503 privado**, sin consulta privilegiada.
- Usuario autenticado confirmado sin error => continuar con controles RLS y propiedad existentes.

Afecta a `GET /api/marketplace/my-school`, `POST /api/marketplace/listings/match-saved-searches`, `POST /api/messages/send`, `GET /api/messages/conversation-summary` y GET/PUT/DELETE de `/api/marketplace/listing-draft`. No toca las credenciales del worker de outbox, las rutas públicas ni los permisos.

## Pruebas y salida
Los tests reales de handler se amplían para reproducir ausencia de sesión con error tipado **incluso acompañado de usuario obsoleto** y verificar 401, cache privada y ausencia de `createAdminClient`. Las simulaciones de Auth fallida por red conservan 503; los contratos escolares de scope y RLS continúan. Requiere CI, Vercel READY y **smoke HTTP real 401 de Mi colegio** tras desplegar.

Sin SQL ni contenido de cuentas privadas. Seguimos 0/3 AMPA, DR integral pendiente y NO-GO.
