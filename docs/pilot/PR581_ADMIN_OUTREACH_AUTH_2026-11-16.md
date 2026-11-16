# PR581 · Seguridad de acciones administrativas con efectos sobre usuarios

16 noviembre 2026 · Endpoints POST:
- `/api/admin/resend-school-admin-access`: reenvío de acceso (puede enviar correo).
- `/api/admin/demand/opportunities/[key]/activate`: activación de ofertas (puede crear notificaciones a familias).

Un error `getUser()` no puede aprovechar una identidad residual. Sesión ausente => 401; avería real Auth => 503; ausencia de superadmin => 403; error de consulta de rol => 503. Respuestas privadas `Cache-Control: private, no-store`; errores genéricos 500 sin diagnósticos internos.

**18 pruebas runtime**: nueve escenarios por ruta. Los mocks abortan si se intenta usar cliente privilegiado, invitar o notificar antes de autorización; ninguna prueba ejecuta SQL, envía correo ni crea notificaciones reales. Las reglas de negocio posteriores no cambian. No autoriza apertura del piloto ni alteración del índice PR570, defaults supabase_admin o respaldos.
