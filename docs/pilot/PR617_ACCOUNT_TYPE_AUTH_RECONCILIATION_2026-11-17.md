# PR617 — Cambio tipo de cuenta: fail-closed + conciliación veraz

17/11/2026. `PATCH /api/account/type` usa cliente service-role para cambiar `account_students`, `profiles.user_type` y `auth.users.user_metadata`. Previamente ignoraba un `authError` con identidad residual, no protegía respuestas frente a caché y prometía un rollback íntegro sin verificar sus escrituras.

**Corrección:** 401 para sesión ausente, 503 para caída/throw de Auth; no se crea cliente privilegiado ante ningún error. Todas las respuestas privadas `private, no-store` (incluidos no-op). Logs sin datos de proveedor. Ante error después de iniciar la coordinación entre PostgreSQL/Auth, devuelve 503 solicitando revisión del estado, sin garantizar falsamente una restauración completa. No se alteran pasos de negocio ni los datos reales.

11 tests sintéticos: seis casos Auth, no-op válido, tipo inválido, dos fallos read-only y contrato del texto de conciliación.

**Riesgo pendiente:** la coordinación de perfil, estudiantes y Auth NO es una transacción distribuida; la recuperación actual sigue best effort. No se han creado cuentas, ejecutado migraciones ni probado E2E real. Piloto NO-GO.