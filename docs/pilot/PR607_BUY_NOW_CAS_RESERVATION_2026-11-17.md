# PR607 — Reservar antes de iniciar compra directa (CAS)
Fecha: 17/11/2026. Issue [#606](https://github.com/ogarnelo/v0-community-marketplace/issues/606).

**Prueba de esquema real:** el UNIQUE `listing_offers_active_negotiation_idx` solo cubre las parejas comprador-vendedor en estados `pending,countered`. El índice parcial `payment_intents_offer_unique_idx` solo agrupa por oferta, no por anuncio. Producción tenía cero ofertas y cero intentos de pago en el preflight agregado.

**Cambio preventivo:** la ruta privada `/api/offers/buy-now` comprueba antes de cualquier escritura si hay una oferta accepted en el mismo anuncio o una negociación activa del comprador. Nunca asume que una oferta accepted previa es un nuevo checkout. La primera escritura es ahora `UPDATE listings SET status='reserved' WHERE id=? AND status='available' RETURNING id`; si no cambia fila =>409, **sin chat/oferta/pago**; si da error =>503. Tras reservar, fallos no se reintentan automáticamente: requieren conciliación manual y el mensaje de error lo indica. Se deja el anuncio reservado a propósito si falla otro paso; no se libera a ciegas para permitir una segunda compra.

**Ocho contratos sintéticos**, incluidos dos intentos con un único ganador simulado y comprobación de orden de efectos. Se conserva `canUserUseCommerce`, Stripe test mode y no se activa comercio general. Esta PR no ejecuta ninguna reserva productiva, no es una prueba de carrera en PostgreSQL ni una garantía de transacción entre rutas.

**Riesgo residual P0 #606 abierto:** `respondToOfferFlow` aún puede confirmar accepted en otra ruta concurrente antes de reservar; la combinación `listing_offers`, `listings`, `payment_intents` y notificaciones no es una única transacción. Hacen falta ensayos de 2 compradores en PostgreSQL aislado y la decisión de un mecanismo transaccional/UNIQUE de alcance global para declarar comercio GO. Ninguna migración SQL autorizada ni aplicada. PILOTO NO-GO.
