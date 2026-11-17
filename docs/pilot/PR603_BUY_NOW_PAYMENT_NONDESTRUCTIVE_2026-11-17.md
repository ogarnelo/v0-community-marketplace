# PR603 · Compra directa: intención de pago sin UPSERT, Auth y conciliación
17/11/2026. Código restringido a comercio privado y pruebas con mocks. No se ha cobrado, escrito ni activado ningún pago real.

**Riesgo real detectado:** `POST /api/offers/buy-now` mantenía `.upsert(...,{onConflict:'offer_id'})` que la PR586 ya eliminó de `create-intent`: `payment_intents` usa UNIQUE **parcial** de `offer_id`; el upsert no es un mecanismo fiable y puede intentar rebajar un pago `succeeded` a `requires_payment_method`. Los errores del proveedor se exponían al cliente.

**Cambio:** módulo `safe-buy-now-intent.ts` hace lectura de intento anterior; solo lo reutiliza SIN escrituras si está `requires_payment_method`, pertenece al mismo listing/comprador/vendedor/escuela y mantiene EUR, proveedor, método de entrega y cada componente de precio en céntimos. Cualquier diferencia o pago finalizado => 409 sin mutación. Si no existe, INSERT; colisión UNIQUE 23505 => 409 y error no privado =>503. Ningún UPSERT/UPDATE.

La ruta rechaza Auth caída aunque `data.user` residual exista, fuerza respuestas JSON `private, no-store`, comprueba lecturas del anuncio, conversación y ofertas, recupera el chat ganador ante UNIQUE 23505, comprueba desocultación, evento, mensaje, touch y notificación, y devuelve 503 de conciliación ante efectos secundarios ya persistidos. Mantiene el gate de `canUserUseCommerce` y la comprobación Stripe test.

**LÍMITES P0 ABIERTOS:** la creación de oferta aceptada, reserva de anuncio y pago aún no forman transacción; distintos compradores podrían competir por el mismo anuncio si se publicara compra directa. Este cambio NO significa idempotencia completa de checkout; estudiar CAS/índice y escenarios concurrentes antes de cualquier GO. Más pruebas E2E reales necesarias; no DDL.
