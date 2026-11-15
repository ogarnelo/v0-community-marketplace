# WETUDY — PR531: cerrar acceso privilegiado prematuro a fotos privadas en main

15 de noviembre de 2026. Corrección puntual basada en main; no integra masivamente QA.

## Hallazgo
El detalle del anuncio y su generación SEO en main consultaban fotos mediante service_role *antes* de determinar la visibilidad del anuncio y la autorización del visitante. Los datos no estaban necesariamente expuestos en la respuesta, pero esta lectura privilegiada prematura ampliaba el riesgo y el coste de la operación.

## Cambio
Se porta exclusivamente el cambio de código ya probado en QA (PR524), verificado contra el diff de main como bloques limitados a validación UUID y secuenciación de consulta de listing_photos. UUID inválido se rechaza antes del cliente admin. Metadata consulta fotos solo si el anuncio es públicamente available. Página comprueba login, owner y participación y consulta fotos a posteriori. Sin cambio en RLS, permisos, API pública, SEO de fichas disponibles ni contenido de filas reales.

## Comprobaciones
Se portan las seis pruebas ejecutables TypeScript/TSX Node en `__tests__/launch/pilot-listing-detail-private-photo-authorization-runtime.test.mjs`. Se agregan a Critical contracts de main junto a las pruebas de foto y ACL de PR529–530. Se requiere CI y compilación de Vercel antes de fusionar.
La migración productiva `p0_listings_atomic_privacy_acl_20261115` ya está aplicada y ha sido validada: anon SELECT 0/36 y auth 33/36, no reabrir grants. La web pública y feed 200 post PR530. E2E autenticado y aceptación de 3 AMPA siguen pendientes. Recuperación parcial previa se reconoce; custodia decidida para día 17.
