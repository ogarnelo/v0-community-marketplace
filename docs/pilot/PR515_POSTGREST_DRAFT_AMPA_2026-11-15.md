# WETUDY — PostgREST HTTP real + privacidad de borradores + decisión AMPA
15/11/2026 | QA exclusivo | no Supabase productivo, main, despliegue ni datos de familias reales.

## Bloque 1 — #447: PostgREST contra PostgreSQL 17 real y desechable
En `.github/workflows/contracts.yml` el servicio `postgrest/postgrest:v12.2.12` conecta únicamente con `wetudy_privacy_ci` dentro de un servicio PG17 de GitHub Actions. La contraseña de PostgreSQL y la clave JWT son **valores fijos públicos exclusivos del CI**, no secretos de WETUDY. Los roles `anon` y `authenticated` son ficticios. Después de los scripts review-only de revocar SELECT y DML anon, el test HTTP verifica rechazo de SELECT/INSERT/UPDATE/DELETE anon, aislamiento de dos sujetos JWT A y B, lectura de solo filas propias, modificación de CP propio y prohibición de modificaciones ajenas, con limpieza de filas sintéticas. Si hay anomalía el job falla y no autoriza despliegues.

Para validar la identidad con PostgREST se sustituyó **únicamente en el fixture efímero** el stub `auth.uid()` por una versión que admite tanto el ajuste histórico `request.jwt.claim.sub` como el objeto JSON `request.jwt.claims` usado en PostgREST. La expresión RLS de propiedad y el allowlist de las políticas reales de backup NO se modifican.

No se prueba el Data API de producción ni la seguridad de todas las tablas/RPC. Los permisos en la base real **NO cambian** por estas pruebas. Deben aprobarse expresamente las propuestas de migración productiva y verificar rutas en despliegue autorizado.

## Bloque 2 — #447: minimización de errores de servicio elevado
En `app/api/marketplace/listing-draft/route.ts`, los errores de lectura/escritura/eliminación de `listing_drafts` y las fallas de limpieza de Storage ya no envían `error.message` del backend al navegador ni imprimen el objeto de error de Storage en logs. Se preservan los estados HTTP originales, la selección por `user_id` y el comportamiento del borrador. Respuestas GET/PUT llevan `Cache-Control: private, no-store`. Pruebas Node ejecutan GET/PUT/DELETE de los handlers reales con Supabase simulado y mensajes sintéticos `DO_NOT_LEAK`. `app/api/account/schools/directory/route.ts` deja de registrar objetos privados de error.

## Bloque 3 — #245: no confundir JSON revisable con autorización
`scripts/pilot-three-ampa-release-evidence-gate.py`: incluso si el manifiesto local incluye tres AMPA con todas las casillas declaradas, devuelve `go:false`, `ready_for_human_review:true` y ahora **exit code 3** (no 0). Un pipeline no puede tratarlo como autorización de lanzamiento por el solo código de salida. El rechazo de actas de prueba y la revisión manual siguen vigentes. **0/3 AMPA reales**.

## Límite de recuperación #455 y GO/NO-GO
La ejecución HTTP sintética no sustituye el replay de políticas del ZIP privado Mac, restore DB/ACL, reinicio real GoTrue/Auth, Storage bytes/permisos ni RTO/RPO. No existe autorización para aplicar DDL productivo ni cerrar #455. El 26/11/2026 es objetivo condicionado: #447, #455 y #245 siguen P0 abiertos.
