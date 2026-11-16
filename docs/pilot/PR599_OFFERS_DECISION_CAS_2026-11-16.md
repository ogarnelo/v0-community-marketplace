# PR599 — Aceptar, rechazar, contraofertar con CAS

Fecha 16/11/2026. Refuerza `respondToOfferFlow` y `POST /api/offers/respond`.

Las decisiones cambian la fila solo si `listing_offers.id`, `status` y `rounds_count` siguen siendo los leídos en preflight; se exige `select('id').maybeSingle()` confirmando fila afectada. No se abre chat ni se notifica antes de completar el cambio. CAS fallido => 409. Para aceptar y contraofertar, el anuncio debe estar available.

Tras confirmar una decisión, se comprueba rechazo de competidores, reserva de anuncio para aceptaciones, evento, mensaje, actualización de conversación y notificación. Error posterior => 503 conciliación sin reintento automático, no un OK falso. Se mantienen turno de comprador/vendedor y límite MAX_OFFER_ROUNDS.

Pruebas runtime con servicios falsos: 3 acciones × (CAS carrera + SQL fallido + positivo + 4 fallos posteriores) = 21, más rechazo de anuncio inactivo para accept/counter, fallo de reserva y contrato HTTP = **25** tests. No escritura de ofertas real ni activación de comercio legacy. El índice único de ofertas activas cubre un comprador, no dos ofertas aceptadas distintas; garantía global requiere SQL autorizado, NO en esta PR.
