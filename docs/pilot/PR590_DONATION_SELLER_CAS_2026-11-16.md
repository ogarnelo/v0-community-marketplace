# PR590 — La respuesta del vendedor no cambia una donación ya resuelta

Fecha 16/11/2026. Armoniza `lib/services/donations.service.ts` y `POST /api/donations/respond` con la protección de decisiones administrativas PR587.

**Antes:** tras leer una solicitud pendiente se hacía `UPDATE ... WHERE id` sin volver a comprobar el estado; el vendedor podía competir con un administrador o con otra petición. La conversación se abría antes de actualizar la solicitud. Las escrituras posteriores no distinguían éxito parcial.

**Ahora:** valida pertenencia de `donation_requests.school_id` y `listings.school_id`, titularidad del vendedor y, para aceptación, que el anuncio esté disponible. Busca asignación anterior para prevenir aprobaciones SECUENCIALES cuando falla el archivado. El UPDATE principal usa `.eq("id", requestId).eq("status","pending").select("id").maybeSingle()`; si no cambia una fila, se responde 409. No crea conversación hasta confirmar la transición. En la aceptación se archiva el anuncio con condición de estado y se rechazan otras solicitudes aún pendientes. Mensajes, evento y notificación comprueban errores; ante fallo posterior la ruta responde 503 con aviso de conciliación, no reintento automático. Errores internos nunca salen al navegador.

**RIESGO RESIDUAL P0:** el índice actual de `donation_requests` es solo de búsqueda por `(listing_id,status,updated_at)`; no existe UNIQUE parcial para un aprobado por anuncio. Dos solicitudes DISTINTAS pueden aprobarse concurrentemente, incluso con CAS individual y preflight. Tampoco existe atomicidad de petición+archivado+historial+mensajes+notificaciones. Se requiere futuro diseño de transacción y migración SQL con preflight de duplicados, autorización separada y rollback verificable. **No ejecutar SQL** en esta PR.

**Pruebas runtime sintéticas:** 9 preflights, 14 acciones por tipo (7×2), 3 fallos posteriores específicos de aceptación, 1 rechazo después de archivado, 1 contrato de respuesta = **28**. Sin escrituras reales en producción ni efectos sobre cuentas.
**NO-GO** piloto general: DR PostgreSQL/Auth/Storage, E2E multicolegio, 3 actas AMPA y autorización final siguen pendientes.
