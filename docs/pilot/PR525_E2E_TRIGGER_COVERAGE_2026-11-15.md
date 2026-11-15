# WETUDY — PR525: cierre de huecos en activación de E2E local
Fecha: 15 noviembre 2026. Exclusivamente rama QA.

## Hallazgo
El workflow `.github/workflows/pilot-three-ampa-real-next-browser.yml` sólo se activaba por una lista estrecha de archivos. Las modificaciones recientes de `app/marketplace/listing/[id]/page.tsx`, `app/api/marketplace/feed/route.ts`, `app/api/marketplace/my-school/route.ts`, borradores, componentes de mensajes y galería NO lo disparaban automáticamente. Por tanto Critical contracts SUCCESS de algunas PR no acredita haber ejecutado E2E Next+Auth+PostgREST para esos cambios.

## Corrección
Ampliar `pull_request.paths` a las superficies de marketplace, escuela, mensajes y fotos. Añadir `scripts/test_pilot_e2e_workflow_trigger_coverage.py` que verifica los nombres imprescindibles, el aislamiento local y la presencia de un contrato CI siempre activado; integrar la prueba en `.github/workflows/contracts.yml`. Así, un cambio futuro del filtro queda sometido a revisión de regresión.

## Alcance
El workflow real local arranca servicios GoTrue/Auth, Storage, PostgreSQL y PostgREST en el runner y utiliza navegador (Playwright). Es más fuerte que un mock de handler, pero solo valida sus escenarios actuales; NO equivale a tres AMPA reales ni a evidencia de uso productivo.

## Integración de privacidad #447
La rama QA previa a PR525 se encontraba 119 commits por delante de main (según comparación anterior) y requiere integración controlada. La migración atómica de ACL de listings está ya preparada `scripts/pilot-listings-atomic-acl-review-only.sql`; es review-only. Prohibido ejecutar en producción sin autorización expresa, rollback y verificaciones. Ningún cambio de esta PR altera datos o concesiones.

## #455 y #245
Evidencias previas de recuperación parcial ya acreditadas; fundador gestiona respaldos el 17/11, sin nuevas solicitudes hasta entonces. Aceptación real AMPA continúa 0/3. Estado apertura NO-GO condicionado a cerrar privacidad productiva y evidencias restantes.
