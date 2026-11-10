# WETUDY · Comprobación automática de respaldo cifrado

El workflow `Wetudy pilot encrypted backup readiness metadata gate` valida en GitHub Actions las condiciones básicas de frescura para un backup de PostgreSQL antes de pensar en aplicar migraciones.

- Consulta **solo metadatos** GitHub, sin descargar ni descifrar el archivo de producción.
- Requiere que el backup cifrado tenga menos de 24 horas y más de 48 horas de retención restante.
- Exige una ejecución posterior con éxito de `Wetudy combined encrypted backup recovery check`.
- Usa permisos de solo lectura `contents: read` y `actions: read`; no requiere secretos Supabase, Resend ni claves de descifrado.
- Corre al modificar el control en `main` y también permite `Run workflow` para futuras comprobaciones.

**Limitación esencial:** la recuperación existente es parcial (directorio escolar y comprobación Storage). Incluso con el workflow en verde, NO se ha validado la restauración completa de Auth, mensajes, anuncios, transacciones y Storage. El workflow no ejecuta SQL, no aplica migraciones y no activa avisos.

Última evidencia directa: backup del 10/11/2026 (artefacto #13810495727, vencimiento 17/11) y recuperación parcial posterior de 10/11/2026 (run #42916784969), ambas correctas. Este documento no declara backup renovado automáticamente todos los días.

Mantener #375 abierto hasta validar política de recuperación, migraciones en orden y E2E autorizada.
