# PR614 — Reserva CAS compartida para aceptar ofertas y compra directa

**Fecha:** 17/11/2026 · issue P0 #606 · sin ejecutar SQL, ofertas reales ni pagos.

Se verificó en main que `respondToOfferFlow` actualizaba la oferta a `accepted` ANTES de reservar el anuncio. La ruta `/api/offers/buy-now` ya reserva el anuncio en primer lugar desde PR607. Esta asimetría permitía que dos operaciones independientes observaran disponibilidad antes de marcar `reserved`.

**Cambio de código:** para `accept`, `respondToOfferFlow` hace primero una única `UPDATE listings SET status=reserved WHERE id=? AND status=available RETURNING id`. Si pierde, devuelve 409 SIN cambiar oferta ni abrir chat. Si gana, intenta la CAS de oferta por `id,status,rounds_count`. Un fallo posterior no libera la reserva ni se comunica como reintento seguro: devuelve **503 de conciliación**. Tras cambiar la oferta, comprueba competidores y mantiene el resto de efectos verificados. Para reject/counter no reserva; continúan usando su CAS anterior.

**Pruebas:** se adaptaron los tests runtime históricos de aceptación para diferenciar fallo de reserva anterior al cambio (409) y pérdida de carrera tras reserva (503). Se añadieron nueve pruebas runtime y de contrato. CI con mocks no sustituye carrera PostgreSQL real.

**Riesgo residual de la #606:** las escrituras de anuncio+oferta+payment no son UNA transacción; fallos parciales dejan reserva pendiente de conciliación; otras rutas como `agreements` pueden tener otro mecanismo. No existe UNIQUE global de accepted por listing. Mantener bloqueo P0 y no abrir comercio hasta autorización de diseño SQL y E2E aislado.