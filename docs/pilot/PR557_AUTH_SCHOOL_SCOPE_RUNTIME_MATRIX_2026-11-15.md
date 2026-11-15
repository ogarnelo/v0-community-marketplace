# WETUDY — PR557 · Prueba de aislamiento del catálogo «Mi colegio» con sesiones sintéticas
15 de noviembre de 2026. No se tocan cuentas reales, RLS ni datos productivos.

## Controles confirmados sobre esquema real
Consulta de solo catálogo a PostgreSQL de producción: `public.listings` contiene la restricción `listings_one_school_reference_chk CHECK (school_id IS NULL OR directory_school_code IS NULL)`. Por tanto, un anuncio válido **no puede tener simultáneamente un colegio operativo y otro código de directorio**, descartando el posible conflicto observado en la revisión inicial. No se necesita alterar el filtro escolar para ese caso; la base lo impide.

## Nueva cobertura de ejecución
`__tests__/launch/pilot-my-school-cross-scope-http-runtime.test.mjs` ejecuta el handler Next.js real `app/api/marketplace/my-school/route.ts` en Node, junto con `parseMarketplaceFeedFilters`, `applyMarketplaceFeedFilters` y `makeMarketplaceSchoolFilter` reales. Simula resultados de PostgREST, usuarios autenticados, alumnos, perfil escolar, rol school_admin, fotografías y favoritos sin acceder a ninguna fila productiva.

Casos: invitado 401 y ninguna consulta con admin; familiar escuela A solo anuncios A; parámetros de URL `schoolId`/`directorySchoolCode` manipulados sin cambiar colegio de sesión; alumno de directorio nacional prevalece sobre perfil previo; rol escolar autorizado prevalece; ausencia legítima de escuela devuelve catálogo vacío; fallos de `profiles`, `account_students`, `user_roles` devuelven 503 privado sin acceder a listings; paginación mantiene ámbito; error en fotografías aborta sin devolver filas parcialmente enriquecidas. Además se comprueba que el dataset sintético respeta el CHECK real.

**Limitaciones**: proveedor Supabase, sesión Auth, base y consultas de directorio están simulados; no representa E2E humano ni certifica 3 AMPA. El filtro PostgREST se verifica como expresión; el motor real solo se comprobó mediante metadatos de constraints. No se ha aplicado migración SQL ni se ha enviado correo.

La autorización y ámbito se derivan de identidad activa del servidor, nunca de parámetros URL. Apertura NO-GO: E2E real, DR integral y aceptación 0/3 AMPA pendientes. Respaldos previstos para 17/11.
