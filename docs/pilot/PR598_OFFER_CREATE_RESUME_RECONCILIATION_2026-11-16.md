# PR598 — Oferta existente y conciliación de nueva oferta

16/11/2026. Corrige un fallo reproducible de `createOfferFlow`: en el camino `existingOffer` se devolvía `conversationId` antes de inicializar la constante. Ahora se localiza o abre el chat de forma explícita y se conserva el contrato de respuesta 409/redirectTo de la API.

El índice real `listing_offers_active_negotiation_idx` es UNIQUE parcial por `listing_id,buyer_id,seller_id` en estados pending/countered. Las colisiones de INSERT 23505 se traducen a error tipado 409 sin repetir inserción.

Tras guardar una oferta nueva, fallos posteriores (abrir chat, evento, mensaje, touch, notificación) ya no devuelven éxito engañoso ni error genérico que invite a repetir: lanzan `OfferSideEffectReconciliationError`, HTTP 503 con mensaje de conciliación y no se reintenta automáticamente. El touch de conversación ahora comprueba fila realmente afectada.

**14 pruebas** de servicio simuladas y contrato de API. No se ejecutan ofertas reales, no se hacen migraciones, no se activa `isLegacyCommerceEnabled` — la venta/oferta legacy sigue deshabilitada para el piloto. Riesgo pendiente: integridad global de múltiples ofertas aceptadas para un mismo anuncio, y atomicidad entre estado, evento y aviso.
