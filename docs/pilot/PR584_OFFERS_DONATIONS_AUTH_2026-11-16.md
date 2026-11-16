# PR584 — Protección de ofertas y donaciones en 4 rutas de negocio

Fecha 16/11/2026. Endpoints POST: `/api/offers/create`, `/api/offers/respond`, `/api/donations/request`, `/api/donations/respond`.

**Error de Auth no equivale a sesión válida ni puede reutilizar `user` residual**. Sin sesión declarada por Supabase=>HTTP 401; proveedor de Auth indisponible=>503; fallo inesperado=>500. El cliente de servicio nunca se instancia si falla Auth o la validación del cuerpo. Todos los JSON llevan `Cache-Control: private, no-store` y las excepciones no reflejan errores internos SQL. Se conserva el bloqueo `isLegacyCommerceEnabled` de las ofertas (404) y se conserva `409 + redirectTo` al chat de negociación existente. En respuesta a oferta se mapean cuatro errores de negocio a mensajes públicos constantes sin eco del texto del proveedor.

**39 comprobaciones runtime**: 4×(6 escenarios de Auth + validación 400 + positivo + excepción SQL) = 36, 2 casos del feature gate, 1 error público de negocio, 1 conflicto 409 y 1 atribución de donación = **41**. Este conteo debe verificarse en CI. No hay inserciones, emails ni notificaciones reales en las pruebas (servicios simulados). No se han aplicado migraciones ni abierto el piloto general.
