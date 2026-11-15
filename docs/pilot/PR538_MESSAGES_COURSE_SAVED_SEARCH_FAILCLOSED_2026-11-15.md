# WETUDY — PR538: privacidad y recuperación visible en mensajes, Mi curso y búsquedas
15/11/2026. Solo código, tests y CI; no alteraciones SQL ni pruebas con datos de familias.

## Hallazgos
1. `app/messages/page.tsx`: mostraba literalmente `error.message` en el HTML de la bandeja cuando fallaba una consulta de conversaciones, con posible filtración de detalles internos del SQL. La lectura de `hidden_conversations` ignoraba errores, pudiendo revelar en la bandeja conversaciones ocultadas por el propio usuario. La consulta del nombre de la otra parte, anuncio o último mensaje también ignoraba errores y construía vistas incompletas.
2. `app/mi-curso/page.tsx`: perfil, estudiantes, escuela y anuncios del curso registraban objetos de error completos, pero seguían con listas vacías y redirigían erróneamente al onboarding. Se reemplazan por fallo genérico antes de cualquier redirección. Los logs de necesidades e historial dejan de incluir excepciones privadas (se conservan tokens de diagnóstico).
3. `app/account/saved-searches/page.tsx`: errores de búsquedas, coincidencias o listings se ignoraban, y además se imprimían detalles SQL. Ahora se rechazan con mensajes genéricos constantes, sin marcar erróneamente las búsquedas como inexistentes.

## Pruebas
`__tests__/launch/pilot-private-inbox-course-failclosed.test.mjs`: ocho escenarios de ejecución SSR real por transpileModule con sesiones sintéticas y errores deliberados, más contrato de 'Mi curso' para evitar logs de excepciones y listas vacías ante permisos fallidos. Se suma a Critical contracts sin reintroducir servicio privilegiado en el cliente.

## Alcance
No se modifica la RLS productiva, ni grants, pagos, ni AMPA. En Supabase PostgreSQL se verificó compatibilidad de esquema/permiso con `SET LOCAL ROLE authenticated`, `SELECT ... LIMIT 0` y `ROLLBACK`: no se leyeron filas de familias. La PR anterior #537 ya protegió los SSR de anuncios, favoritos y perfiles. Falta E2E autenticado humano y aprobación 3 AMPA (0/3). DR parcial acreditada; respaldos gestionados por responsable 17/11. P0 default ACL supabase_admin sigue bloqueado por falta de rol efectivo y quedan 14 tablas MAINTAIN fuera de autorización.
