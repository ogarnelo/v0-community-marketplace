# WETUDY — PR524: autorización antes de fotografías privadas y SEO
Fecha: 15/11/2026. Exclusivamente QA; no producción ni main.

## Problema comprobado en código
La página `app/marketplace/listing/[id]/page.tsx` consultaba `listing_photos` usando `createAdminClient` concurrentemente con `listings` y `auth.getUser`, antes de verificar que el anuncio estaba disponible o que el visitante era propietario/participante. `generateMetadata` también buscaba fotografía antes de comprobar `status='available'`. Eran lecturas innecesarias en contexto privilegiado, no una filtración HTTP confirmada.

## Cambio de seguridad
La página valida UUID (columna `public.listings.id` comprobada como tipo UUID en catálogo real) antes de instanciar el admin. Posteriormente lee anuncio y sesión, aplica la política ya existente: available público; reservado/vendido sólo dueño o conversación autorizada. **Solo después** consulta fotografías. `generateMetadata` retrasa lectura foto hasta comprobar disponible. El SEO de privados sigue noindex; no se han cambiado políticas RLS.

## Verificación
Seis pruebas Node de ejecución de funciones reales transpileModule TSX (dependencias DB/Auth sintéticas) para UUID, visitante anónimo, usuario ajeno, propietario y metadatos. No equivalen a E2E de producción. Incluidas en Critical contracts. No se ha tocado ninguna fila real.

## Integración
QA acumulaba 114 commits delante de main al empezar esta PR. El bloqueo #447 de grants públicos `listings` sigue siendo independiente de este cambio. Hay propuesta transaccional existente `scripts/pilot-listings-atomic-acl-review-only.sql` y E2E locales ya previos; requerirá autorización expresa para producción. #245: 0/3 AMPA aceptadas. Recuperación parcial histórica #455 preservada; próxima actuación sobre respaldos programada por usuario para 17/11, no antes.

Estado lanzamiento: NO-GO.
