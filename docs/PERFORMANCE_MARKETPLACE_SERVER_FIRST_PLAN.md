# Marketplace server-first performance plan

## Diagnóstico actual

La percepción de lentitud en `/marketplace` no parece venir de errores 500. El problema principal está en el render inicial:

1. se carga la página;
2. se descarga e hidrata el JavaScript del cliente;
3. el cliente consulta sesión de Supabase;
4. si hay usuario, consulta favoritos y perfil;
5. consulta anuncios activos;
6. consulta fotos;
7. entonces pinta el grid real.

El usuario ve skeletons demasiado tiempo aunque el HTML inicial podría traer ya los anuncios.

## Objetivo del siguiente PR

Convertir `/marketplace` a server-first:

- `app/marketplace/page.tsx` pasa a ser server component;
- el servidor carga anuncios disponibles y fotos iniciales;
- se pasa `initialListings` a un componente cliente pequeño;
- el cliente mantiene filtros, favoritos e interacción;
- se reduce el tiempo hasta ver contenido útil.

## Riesgos

- Hay que mantener favoritos por usuario sin romper la vista pública.
- Hay que evitar duplicar consultas de fotos.
- Hay que cuidar que filtros actuales sigan funcionando.

## Métrica esperada

Mejora visible en:

- tiempo hasta ver el primer grid de anuncios;
- sensación de click en header/marketplace;
- menor dependencia del `useEffect` inicial.

## Después

Añadir Playwright/Lighthouse para medir navegación real en preview y producción.
