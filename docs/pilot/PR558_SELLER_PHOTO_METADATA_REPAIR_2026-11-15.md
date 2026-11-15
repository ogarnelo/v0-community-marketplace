# WETUDY — PR558 · Reparación controlada de fotografías de anuncios ya creados
15/11/2026. **Cambio de producto con impacto en integridad de datos, sin DDL, permisos SQL nuevos ni lectura de anuncios ajenos.**

## Problema observado en código y esquema
PR554 y PR555 protegen la publicación ante un `INSERT public.listings` confirmado seguido de fallo en `INSERT public.listing_photos`. `listings.photos` conserva el array de URLs, pero la pantalla de edición consultaba exclusivamente `listing_photos`. El vendedor no podía restaurar los metadatos de una imagen ya guardada sin subir otra vez el archivo. Consultas de solo catálogo confirman que `listings.photos` es un array y `listing_photos` dispone de `listing_id`, `url`, `sort_order` y UUID PK; no existe UNIQUE por `listing_id,url`.

## Solución
`lib/marketplace/missing-listing-photos.mjs` compara, por su URL, hasta ocho fotos persistidas en el propio `listings.photos` frente a los registros existentes. Descarta valores no HTTPS y repetidos. La página SSR calcula el faltante **solo después de comprobar `seller_id === user.id`**. Muestra un aviso para reparación explícita sin publicar otra vez. Al pulsar, el navegador vuelve a comprobar Auth, propietario y fotos desde Supabase con **la sesión RLS del mismo vendedor** y vuelve a leer `listing_photos`; inserta exclusivamente los metadatos ausentes y muestra resultado controlado. No usa service_role en el cliente, ni borra fotos ni toca Storage.

## Seguridad, limitaciones y pruebas
Nueve pruebas de fuente/ejecución del helper verifican URLs válidas, duplicados, orden, máximo ocho, dueño antes de cálculo, Auth y RLS antes de INSERT, acción explícita, mensajes privados y TSX. No se tocan filas productivas en las pruebas. Al no existir UNIQUE por `(listing_id,url)`, **dos pestañas concurrentes podrían duplicar metadatos**, por lo que el código minimiza ese riesgo releyendo filas pero no declara exclusión atómica entre sesiones. No se cambia la DB sin autorización.

Pendientes: certificación con login familiar real, E2E de fotos y catálogo, AMPA 0/3, DR integral. Respaldos del 17/11 según decisión. Piloto general NO-GO.
