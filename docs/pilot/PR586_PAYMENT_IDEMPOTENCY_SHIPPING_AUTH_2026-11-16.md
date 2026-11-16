# PR586 — Preparación de pago no destructiva y envíos fail-closed

Fecha: 16/11/2026. Cuatro POST: `/api/payments/create-intent`, `/api/shipments/create-label`, `/api/shipments/mark-dispatched`, `/api/shipments/mark-delivered`.

## Riesgo de pago realmente identificado

En producción `public.payment_intents` tiene índice **UNIQUE parcial** `payment_intents_offer_unique_idx ON (offer_id) WHERE offer_id IS NOT NULL`. El endpoint hacía `upsert(...,{onConflict:"offer_id"})`, que podía volver a escribir `requires_payment_method` y montos en un intento de pago existente, y además no infiere con seguridad un índice parcial sin el predicado. Ahora consulta primero el intento existente; si está `requires_payment_method` y toda la identidad/moneda/centavos/tarifas/entrega coinciden, **lo reutiliza sin escribir**; si ha iniciado/cambiado/terminado, **409 sin mutación**. Si no existe, usa **INSERT**. La colisión única `23505` es un 409 para recarga sin UPDATE ni UPSERT. Un fallo al consultar la situación anterior devuelve 503 y no intenta INSERT.

## Otros controles

Las cuatro rutas rechazan Auth caída antes de service-role. 401 ausencia de sesión; 503 proveedor Auth caído; 404 si comercio está bloqueado por feature gate. Respuestas JSON privadas/no-store y errores SQL sanitizados.

`create-label` ya **no crea admin antes del chequeo de Auth/commerce/body**; lectura de envíos fallida => 503 vs 404 inexistente; los datos SQL del proveedor dejan de mostrarse al cliente o guardarse en `payload.message`. Si Sendcloud ya creó una etiqueta pero falla su actualización en Supabase, ya **no se ejecuta fallback manual destructivo** en esa ruta; se devuelve 503 y requiere conciliación manual antes de reintentar (riesgo residual de etiqueta externa no vinculada, aún por cubrir con E2E real).

Los otros handlers de envío no muestran mensajes internos al usuario y no disfrazan fallo SQL de recurso inexistente. No hemos creado etiquetas, pagos ni cambios reales en producción. Pruebas runtime con mocks; validación de integridad en CI y preview. No se toca SQL ni se abre el piloto general.
