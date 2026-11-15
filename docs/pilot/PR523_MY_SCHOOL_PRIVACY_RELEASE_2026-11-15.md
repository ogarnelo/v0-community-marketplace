# WETUDY — PR523: privacidad HTTP de «Mi colegio» y preparación de release
15/11/2026. **Solo rama QA; no producción ni main.**

## Hallazgo y corrección #447
`app/api/marketplace/my-school/route.ts` imprimía el objeto completo `error` de Supabase en el bloque catch; un objeto así podría contener diagnósticos SQL o datos internos. Ahora solo registra `marketplace_school_feed_read_failed`. Todas las respuestas (401/400/503, éxito y vacío) se construyen a través de `privateJson` con `Cache-Control: private, no-store`.

Se añaden tests Node ejecutando el handler real transpileModule, con dependencias ficticias, verificando autenticación, offset malformado, fallo de consulta de pertenencia y excepción de resolución de colegio; el flujo no crea servicio privilegiado en estos rechazos. Se cablean en Critical contracts.

**Limitación:** las pruebas no acreditan permiso productivo, funcionamiento del navegador real ni que ningún otro endpoint filtre errores.

## Hechos de integración
Comparación GitHub previa a PR523: `integration/pilot-anon-privacy-20261114` va 108 commits por delante de main, cero por detrás y 163 archivos cambiados. Desplegar o mezclar la rama completa no está autorizado automáticamente.

La base real sigue en estado previo: `public.listings` RLS on, anon SELECT 36/36 columnas, política pública para `available`. La propuesta atómica `scripts/pilot-listings-atomic-acl-review-only.sql` existe, sin ejecutar. Requiere revisión de consumidores con CI E2E, ventana autorizada, reversión y verificación posterior. `#447` sigue P0.

Las evidencias históricas de recuperación parcial #455 se mantienen acreditadas y la custodia de respaldos está decidida para 17/11: no repetir esta tarea en cada tanda. `#245` 0/3 AMPA aceptadas realmente. Objetivo 26/11 condicionado: NO-GO.
