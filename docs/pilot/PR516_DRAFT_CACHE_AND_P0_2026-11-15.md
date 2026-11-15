# WETUDY — QA #516: privacidad de caché y continuidad P0
15/11/2026. Rama QA exclusiva; no tocar `main`, Vercel productivo ni Supabase productivo.

## Cambio 1 — borradores
El manejador `app/api/marketplace/listing-draft/route.ts` centraliza la respuesta JSON de GET/PUT/DELETE mediante `privateJson`; añade `Cache-Control: private, no-store` también a 401, 400, 413, 500 y a la respuesta DELETE. No se devuelven errores SQL/Storage. Prueba de regresión Node sobre handlers reales con Supabase ficticio. No se afirma comportamiento desplegado.

## Cambio 2 — prueba exigible
La prueba `pilot-listing-draft-private-api-runtime.test.mjs` comprueba cabecera para éxito, autenticación fallida, validación, tamaño excesivo, error DB y fallo Storage. Una CI verde sólo acredita el código sometido a estos mocks, NO una prueba HTTP de la web publicada.

## Cambio 3 — plan de cierre real (NO-GO)
- #447: autorizar y verificar SQL SELECT+DML en entorno real con lectura previa de grants, backup, rollback aprobado y prueba de radio/CP autenticada. No aplicar automáticamente.
- #455: conservar en privado los artefactos cifrados existentes antes de expirar 18 y 19/11; completar restore Auth/DB/ACL/Storage real sólo en entorno aislado autorizado, con RTO/RPO. Sin Supabase Pro ni segundo proyecto.
- #245: 3 actas AMPA y E2E con cuentas de prueba reales aún sin certificar; ninguna declaración local equivale a aprobación humana.
- Objetivo 26/11 sujeto a evidencias de los tres P0. Estado NO-GO.

## Referencias
PR #514 y #515; issues #447, #455, #245. Mantener documento maestro acumulado, no sobrescribir histórico.
