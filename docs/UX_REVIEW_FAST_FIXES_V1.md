# UX review fast fixes v1

Parche creado a partir de la prueba manual real del flujo de publicación.

## Problemas detectados

- La navegación se percibe lenta, especialmente al cambiar entre rutas del header.
- En `/marketplace/new`, `Marketplace` y `Publicar` podían quedar marcados a la vez porque `/marketplace` hacía match por prefijo antes que `/marketplace/new`.
- Los campos numéricos de precio podían cambiar con la rueda del ratón o con las flechas nativas del navegador.
- El campo ISBN aparecía para categorías que no son libros.
- En detalle de anuncio se mostraba el valor técnico `very_good` en vez de `Muy bueno`.
- El texto `fuera de Wetudy` generaba una sensación defensiva o de poca confianza.

## Cambios incluidos

- Header: `Marketplace` solo se marca en `/marketplace` y en detalles/listados, no en `/marketplace/new`.
- Precio de venta y precio original: pasan a `type="text"` con `inputMode="decimal"` para evitar cambios accidentales con ratón y mantener teclado numérico en móvil.
- ISBN: solo aparece si la categoría seleccionada parece de libros o lectura.
- Detalle de anuncio: estado del material en lenguaje humano (`very_good` → `Muy bueno`).
- Detalle de anuncio: se elimina `fuera de Wetudy` y se sustituye por `la entrega y el pago se acuerdan directamente entre las partes`.
- Imágenes de tarjetas: `loading="lazy"` y `decoding="async"`.
- Galería de detalle: imagen principal con `fetchPriority="high"`; miniaturas con carga diferida.
- Loading UI: se añaden `loading.tsx` para marketplace y detalle de anuncio, de forma que el usuario recibe respuesta visual inmediata al navegar.

## Revisión de renderizado

La lentitud percibida no viene de errores 500: Vercel no muestra errores runtime recientes. El cuello probable está en:

1. Muchas rutas importantes son dinámicas y hacen consultas a Supabase durante navegación.
2. `/marketplace` es una página cliente: primero carga JS, luego obtiene sesión, favoritos, perfil, anuncios y fotos. Esto retrasa el contenido real.
3. Cada tarjeta monta un `FavoriteButton` interactivo; con muchos anuncios aumentará el coste de hidratación.
4. Las imágenes se servían con `<img>` sin pistas de carga/decodificación.
5. No había pantallas `loading.tsx`, así que las transiciones parecían quedarse bloqueadas.

## Siguiente optimización recomendada

Convertir `/marketplace` en una página server-first:

- `app/marketplace/page.tsx` debería cargar anuncios/fotos iniciales en servidor.
- Un componente cliente debería encargarse solo de filtros, favoritos y cambios de UI.
- Así el grid aparece en el HTML inicial y no espera a `useEffect`.

Esto es más grande que un fast-fix y conviene hacerlo en un PR separado para no mezclarlo con cambios de UX.

## Medición recomendada después del merge

- Abrir `/marketplace` y `/marketplace/listing/:id` en móvil con caché fría.
- Confirmar que la pantalla de carga aparece instantáneamente.
- Confirmar que el detalle ya no muestra estados técnicos.
- Confirmar que el campo ISBN no aparece para mochilas, estuches u otras categorías no editoriales.
- Revisar Vercel Speed Insights o Lighthouse para decidir el PR server-first.
