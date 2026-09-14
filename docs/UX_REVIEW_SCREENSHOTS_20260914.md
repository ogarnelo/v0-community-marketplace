# UX review por capturas · 2026-09-14

## Resumen

Revisión basada en las capturas de producción tras PR #25. Hallazgo principal: el producto ya funciona, pero hay fricción y contradicciones visuales/copy heredadas de fases con checkout/envíos.

## Marketplace

### Hallazgo

Existían dos controles que parecían hacer lo mismo:

- `Todos los anuncios` en la barra superior.
- `Solo mi comunidad` en la columna de filtros.

Eso genera duda sobre cuál manda y qué pasa con la distancia.

### Cambio aplicado

- Se elimina el interruptor superior `Todos los anuncios`.
- Se deja un único bloque `Solo mi comunidad` en filtros.
- Si está activado: muestra anuncios del centro.
- Si está desactivado: aparece el bloque `Ubicación y distancia`, preparado para ciudad/zona y radio hasta `+200 km`.

### Nota de producto

Para que el radio sea realmente tipo Wallapop falta guardar coordenadas normalizadas por anuncio/perfil y calcular distancia real en servidor o base de datos. La UI queda preparada, pero no debe ocultar anuncios sin ubicación calculada.

## Precio

### Hallazgo

El slider de precio se sentía poco fluido al arrastrar los puntos.

### Cambio aplicado

- Se sustituye el slider de precio por inputs directos mínimo/máximo.
- Se añaden presets rápidos: `0-25`, `25-50`, `50-100`, `100-200`.

## Página de producto

### Hallazgo

La página es funcional, pero se percibe fría y poco editorial.

### Recomendación

Siguiente iteración: tarjeta lateral más limpia, mejor jerarquía de badges, bloque de confianza más compacto y layout más tipo marketplace moderno. No se ha rehecho por completo en este hotfix para evitar tocar demasiado después de PR #25.

## Chat

### Hallazgo

Aparecía copy antiguo: `Cerrar acuerdo fuera de Wetudy` y una explicación que decía `fuera de la plataforma`.

### Cambio aplicado

- Se cambia a `Confirmar acuerdo entre partes`.
- Se cambia el texto a: `Wetudy conserva el historial del chat y del acuerdo. La entrega y el pago se acuerdan directamente entre las partes.`
- Los mensajes automáticos de propuesta también dejan de usar `fuera de Wetudy`.

## Perfil de vendedor

### Hallazgo

Visualmente es correcto, pero demasiado vacío cuando el usuario no tiene valoraciones.

### Recomendación

Añadir progresivamente: antigüedad, centro si procede, respuesta media, acuerdos confirmados, consejos de confianza y CTA contextual.

## Publicar anuncio

### Hallazgo

La estructura es clara. Mantener foto obligatoria es correcto. Falta todavía una segunda pasada de microcopy y ayudas por categoría.

### Recomendación

Para libros: ISBN visible solo en categorías de libro/lectura, sugerencia de título y estado. Para uniforme/mochila: ocultar campos editoriales.

## Mi cuenta

### Hallazgo

Sigue habiendo copy de envíos y profesionalización que no encaja con el MVP actual.

### Recomendación

Siguiente hotfix: mover dirección/teléfono a un bloque opcional avanzado y cambiar el texto hacia `datos de contacto y comunidad`.

## Actividad

### Hallazgo

La página hablaba de pagos y envíos, aunque el MVP no usa checkout ni logística integrada.

### Cambio aplicado

- Se reemplaza por actividad de conversaciones, propuestas, donaciones y acuerdos.
- Se eliminan secciones de compras cobradas y envíos.

## Footer

### Hallazgo

El footer incluía opciones poco útiles o no maduras para MVP, como ranking/blog, y enlaces legales con `#`.

### Cambio aplicado

- Se simplifica el footer.
- Se prioriza marketplace, publicar, crear cuenta, añadir/registrar centro, ayuda, about, privacidad y términos.
- Se añade copy final MVP: `La entrega y el pago se acuerdan directamente entre las partes.`

## Rendimiento percibido

### Hallazgo

El sombreado/estado de carga verde transmite lentitud cuando hay navegación entre páginas.

### Recomendación

Siguiente iteración técnica:

1. Revisar `loading.tsx` por ruta para usar skeleton neutro y menos llamativo.
2. Evitar loaders globales innecesarios cuando la página puede renderizar contenido parcial.
3. Reducir consultas admin/service role en páginas de usuario.
4. Medir TTFB y tiempo hasta contenido en `/marketplace`, `/messages`, `/account` y detalle.
