# WETUDY — Tres cierres P0: centros públicos, copias DR y evidencias AMPA

15/11/2026. Propuestas solo en QA; no se ha alterado producción ni `main`.

## Privacidad de rutas públicas
`app/api/schools/public/route.ts` ya excluía los centros de prueba (`is_test=false`) en la búsqueda por texto, pero NO en la consulta por ID: una petición pública con un ID de centro de prueba activo podía obtener nombre/ciudad. Se añadió el mismo filtro a la consulta por ID. No se han consultado datos de centros reales para verificar el comportamiento: CI inspecciona el código, y queda pendiente prueba de solicitudes HTTP en un entorno controlado.
El feed `/api/marketplace/feed` ya devuelve `postalCode:null` y distancia aproximada. El `catch` imprimía el objeto de error de Supabase (potencialmente con diagnóstico interno). Ahora imprime únicamente `marketplace_feed_read_failed`. No se pierden los códigos HTTP existentes. La revisión de `sellerId`, otras rutas elevadas y fotos sigue pendiente.

## Recuperación: integridad de pruebas de backup
`pilot-alert-encrypted-backup-freshness.py` certifica únicamente la frescura del artefacto cifrado y correlación de pruebas PARCIALES de recuperación. Las pruebas nuevas comprueban procedencia exacta de artefactos, rechazo de respaldo expirado y, cuando la evidencia parcial y el sobre ACL son positivos, fuerzan `full_disaster_recovery_certified=false` y `production_sql_migration_authorized=false`. Esto NO equivale a restaurar el backup de Mac ni GoTrue/Auth o Storage API.

## Pilotos AMPA: evidencias privadas sin identificadores
El validador de tres AMPA rechaza referencias de acta que parecen URLs, correos o marcadores `dummy`, `fake`, `fixture`, `synthetic`, `sample`, `placeholder`, `example` en una referencia `private:`; es una segunda capa de protección contra falsos positivos. Tampoco puede verificar la autenticidad de un token opaco: toda aceptación sigue necesitando revisión humana. El avance real permanece en 0/3.

## Gates de CI y salida
Las nuevas pruebas fuente se ejecutan en `.github/workflows/contracts.yml`. No abrir el piloto hasta autorizaciones y evidencias de privacidad #447, DR integral #455 y tres AMPA #245. No aplicar DDL productivo ni desplegar desde QA sin consentimiento explícito. Objetivo del 26/11/2026 condicionado.