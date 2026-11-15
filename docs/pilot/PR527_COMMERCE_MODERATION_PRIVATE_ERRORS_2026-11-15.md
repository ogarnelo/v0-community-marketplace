# WETUDY — PR527: frontera de errores de comercio y moderación

Fecha: 15 noviembre 2026. Alcance: integración QA exclusivamente. Ninguna operación de pago real, modificación de datos, cambios SQL productivos ni despliegue en main.

## 1. Tres rutas con fuga potencial de diagnósticos

- `app/api/offers/buy-now/route.ts`: el error de insertar conversación u oferta podía devolverse mediante `conversationError?.message` / `offerError?.message`; el catch exterior devolvía `error?.message` o `error?.details`.
- `app/api/payments/create-intent/route.ts`: el catch devolvía mensajes internos del proveedor o de Supabase.
- `app/api/reports/route.ts`: el catch escribía el objeto de error completo en logs y devolvía al cliente `error?.message` o `error?.details`. Los reportes de moderación pueden contener información delicada.

Correcciones: mensajes HTTP 500 fijos, sin detalles del proveedor, logs con token fijo, y `Cache-Control: private, no-store` en respuesta final de éxito y catch de las tres rutas. En buy-now también se minimizan los errores de creación de conversación/oferta. No se alteran cálculos, autorización, estados de pagos ni reglas de negocio.

## 2. Cobertura
`__tests__/launch/pilot-commerce-report-error-boundary-runtime.test.mjs`: ejecutar handlers POST reales transpileModule ante fallo simulado de `createClient` y comprobar 500, cache privado, ausencia de marcador SQL y código fijo de log. Contratos de fuente impiden regresiones de `error?.message`, `error?.details` y logging de excepciones. Añadidos a Critical contracts.

Estas pruebas **no certifican operaciones Stripe reales** ni habilitan monetización. Se mantienen prohibidos pagos reales y activación del comercio sin autorización.

## 3. Evidencia de esquema y release
Consultas SELECT de metadatos al catálogo Supabase confirmaron que `listings.id`, `listing_offers.id` y `conversations.id` son UUID. No se han leído filas. El problema original #447 de SELECT anónimo de `listings` permanece pendiente de la propuesta SQL transaccional ya existente y autorización expresa. Se conservan las evidencias previas de recuperación parcial #455 y la decisión del responsable de gestionar respaldos el día 17. #245: 0/3 AMPA aceptadas. NO-GO apertura hasta garantías reales.
