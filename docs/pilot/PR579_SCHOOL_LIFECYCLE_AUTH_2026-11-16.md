# PR579 — Puerta de Auth previa al ciclo administrativo de colegios

Fecha: 16/11/2026. Rutas POST: `/api/admin/approve-school-request`, `/api/admin/delete-school`, `/api/admin/invite-school-admin`, `/api/admin/link-directory-school`.

Corrección de P0: nunca aceptar una identidad residual cuando `getUser()` indica fallo. `AuthSessionMissingError` / `session_not_found` => 401, errores reales de proveedor => 503 sin buscar roles; ausencia de super_admin => 403, fallo de lectura de roles => 503. No cambia las consultas a `user_roles` ni el privilegio necesario para cada acción. La vinculación, cuya Auth estaba fuera de `try`, ahora devuelve una respuesta segura sin excepción no controlada.

Se evita enviar al cliente el texto arbitrario de excepciones de aprobación, borrado, invitación y asignación oficial. Todas las respuestas JSON usan `private, no-store`. **36 pruebas runtime** (32 negativas de Auth/roles, cuatro de validación autorizada) con servicios falsos; no ejecutan RPC, borrados, correos o escrituras reales. Se conservan las reglas previas de revisión manual, validación del directorio y vinculación explícita con confirmación.

**No autoriza alta, borrado ni invitación real, no modifica SQL, ACL, respaldos ni apertura del piloto general. NO-GO.**
