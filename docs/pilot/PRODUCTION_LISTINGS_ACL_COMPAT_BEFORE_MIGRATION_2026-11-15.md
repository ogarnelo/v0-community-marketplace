# WETUDY — Despliegue necesario ANTES de revocar permisos productivos de listings
Fecha 15 noviembre 2026. Estado: **main aún incompatible**; este cambio es una propuesta de compatibilidad para revisión, no una autorización para desplegar.

## Comprobación de lectores de la versión productiva real
El 15/11 se consultaron los archivos exactos de la rama main y el despliegue de producción de Vercel. A diferencia de QA, la página principal `app/marketplace/page.tsx` usa el cliente de sesión para contar y leer anuncios; `app/api/marketplace/feed/route.ts` lo usa en dos caminos (normal y de radio); y `app/api/marketplace/my-school/route.ts` lo usa para listar los anuncios del colegio. Estas consultas incluyen `postal_code`, o dependen de rol anon, por lo que fallarían después de la propuesta atómica 33-column SELECT / anon revoke.

## Orden seguro propuesto
1. Fusionar **por separado y con aprobación** esta PR mínima de compatibilidad en main y verificar su despliegue en Vercel (no hacerlo en esta PR automáticamente).
2. Confirmar pruebas preflight de catálogos y compatibilidad HTTP: feed público, búsqueda por CP/radio, "Mi colegio", detalle, favoritos, mensajes y creación/edición.
3. Confirmar capacidad de recuperación y ventana supervisada; una backup parcial no certifica un rollback de base + Auth + Storage.
4. Ejecutar con autorización expresa la transacción exacta `scripts/pilot-listings-atomic-acl-review-only.sql` ya verificada en QA. Preflight debe rechazar cualquier desviación de grants/schema/RLS.
5. Verificar inmediatamente anon SELECT/DML revocados y authenticated solo 33 columnas no sensibles, edición de CP conservada, PostgREST y app; ante anomalía aplicar reversión aprobada. No activar pilot general automáticamente.

## Alcance del cambio de código
Se sustituyen solo las cinco lecturas `listings` del cliente de sesión en las tres superficies por el cliente de servidor ya importado. En "Mi colegio", el cliente privilegiado se instancia después de comprobar auth y school scope, sin aceptar escuela enviada por la URL. Se conserva `status='available'`, lectura servidor para distancia y `postalCode:null` en las tarjetas. Tres contratos nuevos corren en Critical contracts.

No se cambian directamente permisos, políticas RLS, datos personales, pagos ni despliegues. La rama release está basada en main para minimizar los riesgos de integrar QA completa (más de 160 commits).
