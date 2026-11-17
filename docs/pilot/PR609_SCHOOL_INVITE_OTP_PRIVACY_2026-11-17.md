# PR609 — Invitación AMPA: activación OTP privada y errores seguros

Fecha 17/11/2026. `POST /api/auth/activate-school-invite` usa un token OTP de `invite` o `magiclink`, que representa un mecanismo de acceso sensible. No es una ruta autenticada por sesión previa; la prueba del token es su verificación con Supabase Auth.

**Problemas:** la respuesta original no enviaba `Cache-Control`; la excepción `cause?.message` se devolvía al cliente; un `tokenHash` JSON no string podía arrojar `TypeError`, exponiendo el mensaje interno; una caída Auth se confundía con token inválido.

**Cambio:** `private, no-store`, `Pragma: no-cache`, `Referrer-Policy: no-referrer` en todos los JSON; se comprueba token string no vacío, tamaño hasta 256 y tipo exacto de la lista existente. Los errores Auth por token inválido son 400 y los de proveedor 503; jamás se muestran excepciones ni tokens. Resultado exitoso conserva `/auth/complete-invite?next=/admin/school`.

**20 casos runtime con mocks** de token correcto, errores, sesión de invitación y resultados parciales. No se invocó Auth real ni se enviaron invitaciones; no altera SQL. Continúa pendiente E2E real de invitación AMPA y aprobación de 3 AMPA; piloto general NO-GO.
