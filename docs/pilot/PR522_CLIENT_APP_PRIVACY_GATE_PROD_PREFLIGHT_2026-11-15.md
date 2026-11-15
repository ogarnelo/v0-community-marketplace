# WETUDY — PR522: gate de privacidad de la UI cliente y preflight productivo
15/11/2026 · Sólo QA, sin cambios en producción ni main.

## Resultado 1 — Auditoría de superficies de navegador
Se amplía el control `scripts/pilot-privacy-client-surface-gate.mjs`: antes solo examinaba `components/`; ahora analiza también archivos de `app/` marcados como `"use client"`. Detecta lecturas directas de `listings` mediante `.select("*")` o selección de `postal_code/lat/lng`. Mantiene los seis contratos anteriores. **No sustituye una auditoría completa de consultas dinámicas, librerías compartidas ni runtime HTTP**.

## Resultado 2 — Precondiciones de ACL obtenidas de producción (solo catálogos, cero filas de usuarios)
Metadatos comprobados mediante SQL SELECT de Supabase Education Marketplace: `listings` 36 columnas; 36 seleccionables por anon, 36 por authenticated; las 3 columnas precisas `postal_code, lat, lng` aún disponibles por authenticated; política `listings_select_available_public` presente; dos funciones geo esperadas, service_role puede leer. No se ejecutó DDL ni DML. Por tanto **los supuestos de partida de `scripts/pilot-listings-atomic-acl-review-only.sql` siguen coincidiendo**, pero falta verificar consumidores API y guardas detalladas antes de aprobar; no aplicar todavía.

## Resultado 3 — Ruta real de pruebas y release
Existe workflow `.github/workflows/pilot-three-ampa-real-next-browser.yml`: arranca Supabase/GoTrue/Storage/PostgREST y la página de colegio Next.js en un stack local desechable y ejecuta pruebas de navegador. Modificar el gate está incluido expresamente entre sus triggers, de modo que esta PR obliga a ejecutarlo además de CI básica. No confundir con aceptar 3 AMPA reales (0/3).

Comparación GitHub QA vs main en fecha de revisión: 105 commits por delante y 162 archivos cambiados, sin commits detrás. Desplegar QA sin aprobar migración SQL y prueba autorizada de privacidades es NO-GO. La decisión del fundador sobre respaldos es intervenir el 17/11; la recuperación parcial está acreditada previamente y no se reevalúa aquí.
