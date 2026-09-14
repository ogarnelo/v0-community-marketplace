# Product page polish v1

## Motivo

Tras revisar las capturas de producción del flujo marketplace, la página de producto necesitaba una jerarquía visual más clara y menos sensación de ficha técnica.

## Cambios aplicados

- Fondo de página más suave para separar el detalle del layout general.
- Galería dentro de una tarjeta más editorial.
- Cabecera de producto con título, vendedor, fecha y precio destacado.
- Descripción separada con bloque propio.
- Datos del material en tarjetas compactas.
- Columna lateral sticky con resumen, CTA, confianza y vendedor.
- Bloque `Cómo funciona` con pasos visuales.
- Skeleton neutral para evitar el sombreado verde fuerte durante cargas.
- `Mi cuenta` cambia el enfoque de `envíos` a `datos opcionales de contacto`.

## Pendiente posterior

La distancia real tipo Wallapop debe ir en otra iteración:

1. Guardar ciudad/zona normalizada.
2. Guardar coordenadas en perfiles/anuncios.
3. Calcular distancia en Supabase o RPC.
4. Ordenar y filtrar por radio real.
5. Añadir selector visual de zona/mapa.

No se debe simular distancia real solo desde UI si los datos no existen todavía.
