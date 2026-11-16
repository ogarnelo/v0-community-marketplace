# WETUDY — PR571 · Fallo Auth no equivale a visitante sin sesión en «Mi colegio»

16/11/2026. Protege la página privada /api/marketplace/my-school sin modificar permisos ni consultas productivas normales.

**Hallazgo:** el endpoint devolvía HTTP 401 tanto al visitante legítimo sin sesión como ante una respuesta de `getUser()` con `error`; una excepción de Auth, cliente o consultas de perfil podía escapar sin el JSON privado que espera el frontend. No se producía una exposición comprobada de anuncios, pero sí un fallo operativo de manejo de errores, que puede llevar al usuario a reautenticarse innecesariamente.

**Corrección:** distinguir ausencia de sesión 401 de Auth fallida 503; encapsular la preparación de sesión, perfil, alumnos y ámbito escolar en un catch final con token interno fijo y HTTP 503 con `Cache-Control: private, no-store`. Se conserva la comprobación de ámbito anterior a `createAdminClient`, las reglas de directorio nacional y la paginación.

**Pruebas:** seis casos runtime del handler real Next.js simulan Auth error con usuario obsoleto, Auth throw, fallo al crear el cliente, error inesperado de consulta de perfiles, invitado 401 y log fijo sin diagnósticos. La matriz anterior de 12 pruebas de aislamiento escolar también permanece en CI. Ninguna prueba utiliza cuentas de familias.

AMPA 0/3, restauración integral y E2E con sesiones reales pendientes; no abrir piloto.
