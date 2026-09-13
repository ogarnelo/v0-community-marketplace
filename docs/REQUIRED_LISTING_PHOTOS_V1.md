# Required listing photos v1

## Objetivo

A partir del MVP público, todo anuncio nuevo debe tener al menos una foto real del material.

## Cambios

- El formulario de `/marketplace/new` bloquea la publicación si `photos.length === 0`.
- La UI marca las fotos como obligatorias.
- Las fotos se suben antes de crear el anuncio.
- El anuncio se crea con `photos: photoUrls` para mantener consistencia con `listings.photos`.
- También se insertan filas en `listing_photos` para compatibilidad con componentes existentes.

## Motivo

Los anuncios sin foto reducen confianza, calidad percibida y conversión. En esta fase Wetudy necesita inventario real y visible.
