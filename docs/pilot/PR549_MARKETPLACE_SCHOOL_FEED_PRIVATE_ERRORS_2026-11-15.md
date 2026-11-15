# WETUDY — PR549: respuesta privada y registro seguro de errores de feed y Mi colegio
15/11/2026. Sin migraciones SQL y sin cambios de filtros, RLS, página ni catálogo.

Tras restringir la lectura de listings, las rutas `/api/marketplace/feed` y `/api/marketplace/my-school` ya utilizan en sus lecturas justificadas clientes de servidor, preservando los filtros de `status=available` y ámbito de escuela. Sin embargo, los catches registraban los objetos de excepciones completos de Supabase; determinadas ramas 400, 401 y 503 no declaraban Cache-Control privado de manera explícita. El parche deja logs con tokens fijos y protege uniformemente las respuestas erróneas con `private,no-store` (sin alterar el HTTP status ni el texto UX). Siete contratos Node prueban los dos ficheros y su sintaxis TS.

No se leen datos reales. Mantener #245 0/3 AMPA, DR integral pendiente y piloto general NO-GO. Los permisos internos predeterminados supabase_admin están administrados por Supabase y no son un motivo para pedir claves al fundador.
