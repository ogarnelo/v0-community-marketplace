# PR608 — Comerciante privado: Auth verificada antes de Stripe, presupuesto privado
Fecha: 17/11/2026. Protege cuatro handlers de tres rutas: GET/POST `/api/commerce/connect/account`, GET `/api/commerce/connect/onboarding`, POST `/api/payments/quote`.

Antes, las rutas extraían `data.user` e ignoraban `authError`. Un proveedor Auth indisponible con identidad residual podía permitir continuar hacia Stripe y consultas service-role. Los errores del presupuesto de pago devolvían `error.message/details` al cliente; los JSON no llevaban `private, no-store`. El onboarding redireccionaba sin evitar caché.

Ahora `getVerifiedCommerceUser()` rechaza la sesión ausente (401) y el proveedor caído/throw (503), incluso con usuario residual. El contexto de Stripe/servicio con permisos ampliados solo se inicia después de pasar Auth y el gate privado. JSON y redirects son `private, no-store`; el presupuesto retorna 503 genérico, sin mostrar SQL ni mensajes de proveedores. Se conserva `canUserAccessPrivateCommercePreview`, Stripe TEST obligatorio y NO se habilita el comercio público.

Contratos de runtime para Auth y de código para los cuatro handlers, con mocks, sin credenciales/Stripe/DB reales. No modifica SQL, pagos, autorizaciones ni perfiles; no resuelve la reserva global P0 #606. Piloto general NO-GO.