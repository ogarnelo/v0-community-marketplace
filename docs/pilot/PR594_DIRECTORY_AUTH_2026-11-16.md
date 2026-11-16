# PR594 — Directorio oficial escolar: fallar cerrado ante caída de Auth

16/11/2026. GET /api/account/schools/directory. Solo familias autenticadas con correo confirmado pueden buscar centros por nombre o código oficial, mediante cliente de servicio.

ANTES: un error de Auth se devolvía siempre como 401; una excepción de createClient/getUser fuera de try escapaba sin JSON privado; la captura del servicio imprimía el objeto de error completo. No había indicios de que se sirviesen centros al fallar Auth.

AHORA: sesión ausente reconocida => 401, proveedor Auth caído => 503 (aunque devolviera usuario residual), excepciones de cliente/sesión => 503. Solo usuario confirmado pasa al servicio administrativo. Se conserva validación de 8 dígitos, consulta por 3-90 caracteres, máximo 7 términos, 20 centros y private/no-store en todas las respuestas. Errores se registran por código genérico, sin volcar payload de SQL.

14 pruebas runtime sintéticas de ausencia/fallo de Auth, usuarios no confirmados, parámetros inválidos, consultas válidas y error de lectura. No hay llamadas reales al directorio ni escrituras de datos; no cambia la política RLS de DONACIONES #591 ni abre piloto. Los detalles de la SQL candidata siguen review-only en PR592.
