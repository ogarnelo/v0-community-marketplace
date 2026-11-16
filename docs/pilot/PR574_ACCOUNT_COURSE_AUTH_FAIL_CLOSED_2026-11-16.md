# PR574 — Fallos de Auth en gestión de estudiantes y Mi curso

Fecha: 16 de noviembre de 2026. **Sin operaciones SQL, cuentas reales, emails, respaldos ni apertura piloto.**

Cinco archivos de rutas cubren 9 operaciones: estudiantes GET/POST/PATCH/DELETE; necesidades Mi curso GET/POST/DELETE; búsqueda por mí POST/DELETE. Antes, `getUser()` ignoraba `error`, permitiendo continuar con un `user` residual. Ahora las cinco rutas distinguen invitado sin sesión (401) de fallo real Auth (503) y cortan el acceso antes de servicios privilegiados. También capturan excepciones de creación del cliente/Auth con 503, sin exponer mensajes internos. Todas las respuestas privadas (éxito, 400/401/403/500/503) llevan `Cache-Control: private, no-store`.

Se preservan controles de email confirmado, titularidad y validaciones existentes, que siguen dentro de los servicios. Pruebas de handler runtime: 54 escenarios negativos de Auth, 8 de email sin confirmar y 9 de operaciones legítimas = **71**. Los mockups no acceden a Supabase ni servicios reales.

**Puerta NO-GO:** E2E real de AMPA/familias, restauración completa y aceptaciones AMPA siguen pendientes. PR570 de fotos no autorizada para producción.
