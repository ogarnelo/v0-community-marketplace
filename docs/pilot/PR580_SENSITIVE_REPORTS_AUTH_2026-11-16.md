# PR580 — Exportaciones de informes y correos administrativos protegidos

Fecha 16/11/2026. Superadministrador: `GET /api/admin/super/report` (CSV/PDF), `POST /api/admin/super/report-subscription`. AMPA/colegio: `GET /api/school/impact-report` (PDF), `POST /api/school/report-subscription`, `POST /api/school/send-impact-report`.

Las cinco rutas **no aceptan identidad residual** si `getUser()` devuelve error. Sesión ausente=>401; proveedor real indisponible=>503. Consulta de roles fallida=>503 y rol inexistente=>403; antes de crear un cliente de servicio, leer informes o enviar un correo. Las excepciones provocan respuesta JSON genérica sin filtrar diagnóstico interno y toda respuesta lleva `Cache-Control: private, no-store`. Las exportaciones PDF/CSV conservan su tipo de contenido y descargas.

**42 comprobaciones runtime** (40 escenarios de Auth/roles y dos exportaciones autorizadas con mocks). El test no envía correos ni toca tablas reales. Los roles se siguen validando en `user_roles` y no se amplían permisos. No ejecuta informes reales. Piloto NO-GO hasta E2E/DR/3 AMPA y autorización explícita.
