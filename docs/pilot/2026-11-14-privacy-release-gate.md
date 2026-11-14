# WETUDY · P0 Puerta de privacidad del piloto (14/11/2026)

**Estado:** NO-GO. **Rama:** integration/pilot-anon-privacy-20261114; PR #438 sigue abierta. **Sin ejecución productiva.**

## Hechos y límites
- PR #461 ensaya REVOCATION de INSERT/UPDATE/DELETE para anon en PostgreSQL 17 sintético. PR #462 reporta grants DML en el preflight READ ONLY. Esto NO modifica los grants reales.
- La propuesta `scripts/pilot-anon-listings-revoke-proposal.sql` revoca SELECT de `anon` en `public.listings`; está marcada REVIEW-ONLY. Su aplicación sin inventario completo de consumidores puede romper funciones.
- PR #463 ensaya identidades sintéticas comprador/vendedor/tercero y mensajería en GoTrue/PostgREST local. PR #464 añade comprobación de participación antes de `service_role`. PR #465 amplía gate RLS/ACL en el catálogo productivo. Ninguno certifica prueba con familias reales.

## Matriz que debe quedar en verde ANTES de considerar una migración
| ID | Prueba necesaria | Evidencia aceptable | Estado |
|---|---|---|---|
| PRIV-01 | Inventario completo de lecturas de listings (REST, RPC, detalles, fotos, Realtime, email, jobs) | Rutas/codeowners y tests por consumidor | PENDIENTE |
| PRIV-02 | Anon no puede leer CP ni lat/lng ni seller_id, ni por SQL/PostgREST/RPC | SQL catálogo READ ONLY y pruebas de denegación por cliente anon | BLOQUEADO en producción |
| PRIV-03 | Anon no tiene grants INSERT/UPDATE/DELETE | has_table_privilege y has_column_privilege | BLOQUEADO en producción |
| PRIV-04 | Usuario autenticado puede publicar y editar CP solo de anuncio propio | E2E buyer/seller + intento de acceso cruzado | PENDIENTE |
| PRIV-05 | Feed público y filtros radio por CP funcionan sin filtrar datos personales | 60/página, scroll infinito, cero anuncios ocultos, búsqueda exhaustiva | PENDIENTE |
| PRIV-06 | Fotos públicas y privadas conservan RLS y acceso a bytes esperados | E2E Storage local y test de URL por terceros | PARCIAL (sintético) |
| PRIV-07 | Chat y profiles no son visibles a tercero/anon, ni por Realtime | Contratos y E2E dos cuentas + tercero | PARCIAL (sintético) |
| PRIV-08 | Backup íntegro y plan de reversión aprobado | #455, pruebas de restore, RTO/RPO medidos | PENDIENTE |

## Secuencia de actuación
1. Congelar cambios adicionales en `main` para este piloto; inventariar consumidores y ejecutar tests sin datos personales.
2. Repetir preflight SELECT/DML/RLS de solo lectura; guardar sólo semáforos y metadatos, nunca CP/correos/mensajes.
3. Preparar plan de migración reversible revisado (con medición de duración y monitoreo); **no ejecutar SQL de propuesta** sin autorización expresa y recuperación integral validada.
4. Realizar E2E autorizado con cuentas sintéticas y tres AMPA; no abrir a familias por passes parciales.

**Condición de parada:** cualquier lectura indebida, pérdida de datos, error de RLS, escritura anónima posible, rotura de feed/chat/fotos o fallos de reversión => NO-GO inmediato. No reabrir SELECT amplio anon como arreglo rápido.
