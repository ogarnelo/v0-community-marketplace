# PR576 — Protección de Auth y respuestas privadas en moderación y administración

16/11/2026. Alcance: POST `/api/reports`, `/api/admin/reports/status`, `/api/admin/toggle-school-active` y `/api/admin/reject-school-request`.

Asegura que un error de `getUser()` no convierta a un usuario residual en identidad válida. `AuthSessionMissingError` / `session_not_found` => 401. Avería real del proveedor => 503 antes de leer roles o iniciar operaciones privilegiadas. Excepciones no pasan a clientes (500 controlado). Role query fallida => 503 distinto de falta de permiso 403. Respuestas JSON privadas con `Cache-Control: private, no-store`. Tres catches administrativos eliminan la reflexión de errores internos.

**30 pruebas de handler runtime**: 24 combinaciones de Auth, 6 negativas de roles. Mantiene contratos previos de control de acceso y validación. No ejecuta SQL, envía correos, modifica comunidades, respaldos ni abre piloto. Condición NO-GO sin recuperación integral y E2E/AMPA reales.
