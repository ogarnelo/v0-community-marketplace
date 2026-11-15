# WETUDY — PR537: impedir falsos estados vacíos ante errores de permiso
Fecha 15/11/2026; alcance acotado a main, sin tocar SQL ni abrir piloto.

## Hallazgo reproducible en código productivo
Los SSR de Mis anuncios, Favoritos y perfiles de vendedores usaban `data || []` incluso si Supabase devolvía `error` (lectura de `listings`, `listing_photos`, `listing_offers` y `listing_drafts`). Tras el endurecimiento ACL de `listings`, una regresión RLS, un fallo de schema o una interrupción de PostgREST podía mostrarse engañosamente como catálogo vacío, fotos ausentes u ofertas inexistentes.

## Corrección
Las páginas distinguen un resultado vacío legítimo de un error. En caso de fallo de consulta, abortan con un identificador genérico (sin SQL ni datos personales en el texto de la excepción) en vez de ocultarlo. No amplía permisos ni cambia la selección de filas. No usa el cliente privilegiado para sustituir los permisos autenticados normales.

## Verificación
- Suite Node `__tests__/launch/pilot-auth-marketplace-read-failclosed-runtime.test.mjs` ejecuta los componentes SSR reales transpileModule con clientes Supabase ficticios y errores deliberados en nueve caminos, sin contactar con producción ni leer datos personales.
- Se añade a Critical contracts de la rama main. Antes de fusionar, exigir CI verde y Vercel preview READY.
- Metadata SQL de producción (BEGIN READ ONLY, SET LOCAL ROLE authenticated, LIMIT 0) ha confirmado que las selecciones del editor y fotos compilan bajo el rol autenticado, pero no reemplaza E2E con sesiones reales. Las verificaciones públicas www.wetudy.com/marketplace y feed siguen 200.

## Estado
En Supabase: 48 tablas endurecidas; 392 grants ordinarios preservados, 18 MAINTAIN en 14 tablas fuera de alcance, default ACL postgres 0, supabase_admin 16 (se requiere operador privilegiado legítimo). No reabrir permisos ni realizar nueva migración por este cambio. #245 0/3 AMPA. Recuperación parcial histórica confirmada, custodia definida para 17/11. No se autoriza apertura.
