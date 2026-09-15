# Mobile-first publish V1

## Decisión de producto

Esta iteración mejora publicación y marketplace sin introducir todavía intercambio, pagos, checkout, envíos integrados ni mapas de pago.

El alcance mantiene el MVP actual:

- publicar material escolar
- vender o donar
- contactar por chat
- acordar entrega y pago directamente entre las partes
- confirmar el acuerdo y conservar historial

## Cambios principales

### Publicación estilo app

El formulario de nuevo anuncio pasa a una estructura de scroll por bloques, inspirada en marketplaces móviles:

1. Fotos
2. Información básica
3. Categoría y detalles
4. Precio o donación
5. Resumen y publicar

La acción de publicar queda fija en móvil para facilitar uso en iPhone, Android y pantallas pequeñas.

### Fotos

- La foto sigue siendo obligatoria.
- El límite visual sube a 8 fotos.
- La primera imagen se marca como principal.
- La cuadrícula se adapta a móvil, tablet y desktop.

### Categorías educativas

Se ajustan las categorías al vertical escolar:

- Libros de texto
- Lectura y literatura
- Material escolar
- Uniformes
- Tecnología y calculadoras
- Mochilas y estuches
- Música
- Deporte escolar
- Material universitario
- Otros

No se incluye videojuegos como categoría principal para no diluir el foco escolar.

### Campos dinámicos por categoría

El formulario muestra campos recomendados según categoría:

- Libros: ISBN, autor, editorial, formato, idioma.
- Libros de texto: asignatura.
- Uniformes: prenda, talla, temporada.
- Material escolar: tipo de material.
- Tecnología y calculadoras: tipo, marca, modelo.
- Mochilas y estuches: tipo y marca.

Los campos específicos que no tienen columna propia todavía se incorporan a la descripción bajo el bloque `Detalles del material`, para evitar una migración grande en esta fase.

### Marketplace responsive

- Buscador más claro: título, curso, ISBN o categoría.
- Filtros móviles en bottom sheet.
- Botón flotante de publicar en móvil.
- Chips rápidos por categoría en móvil.
- Se elimina el filtro visual de ubicación/distancia preparado, ya que todavía no hay ubicación real ni proveedor de mapas.

## Fuera de alcance

No se introduce:

- intercambio
- entrega preferida
- mapas
- geocoding/autocomplete
- Stripe Connect
- Correos/DHL
- Apple Pay
- checkout
- carrito
- peso/dimensiones
- dirección exacta

## Próximos pasos sugeridos

1. Validar responsive real en producción: iPhone Safari, Android Chrome, tablet y desktop.
2. Revisar si los campos dinámicos deben convertirse en columnas propias.
3. Decidir proveedor de geocoding/mapa si se quiere selector de ubicación tipo Wallapop.
4. Mantener Stripe/Correos como laboratorio técnico separado, no como flujo público.
