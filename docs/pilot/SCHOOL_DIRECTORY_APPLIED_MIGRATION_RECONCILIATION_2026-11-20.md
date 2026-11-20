# WETUDY — reconciliación del catálogo nacional en historial de migraciones

**Fecha:** 20/11/2026. **Estado:** ya aplicado; esta PR solo restaura el archivo al repositorio. **No ejecutar SQL nuevamente.**

## Evidencia de origen

- Proyecto Supabase: Education Marketplace (`jpsljmakoscqevssimtk`).
- Versión del historial real: `20261108101652`, nombre `school_directory_catalog`.
- SQL reconstruido: extraído en modo **solo lectura** de `supabase_migrations.schema_migrations.statements`; comparado con `supabase/migrations/20261107235900_school_directory_catalog.sql` de la antigua PR #242. **Coincidencia de contenido normalizado: 100 %**, 3.071 caracteres sin los espacios finales.
- Archivo fuente restaurado: `supabase/migrations/20261108101652_school_directory_catalog.sql` (versión remota real, no la fecha local obsoleta de la PR #242).
- El historial de Supabase ya contiene esa versión. Esta PR **no llama** a `apply_migration` ni `execute_sql` para DDL.

## Postflight de solo lectura

| Control | Comprobación |
| --- | --- |
| Catálogo nacional | 34.845 registros importados |
| Publicados (`is_listed=true`) | 0 |
| Aprobados para SEO (`seo_indexable=true`) | 0 |
| Vinculados a colegios operativos | 0 |
| RLS | Habilitada |
| Lectura por `anon` | Denegada |
| Lectura por `authenticated` | Denegada |
| Lectura por `service_role` | Permitida |

El SQL no importa datos: crea la tabla, tres índices parciales para fichas publicadas, políticas de seguridad por **ausencia de grants a clientes**, y valores `false` para publicación e indexación.

## Reglas de continuidad

No reintroducir toda la PR #242: sus rutas y componentes útiles se portaron y revisaron en #779, #780, #781 y el hotfix #782. Conservar la PR histórica como evidencia y cerrar únicamente cuando se haya verificado que los tests sintéticos restantes no contienen controles esenciales pendientes.

Esto resuelve el **desfase de historial de recuperación** para la tabla de catálogo; no autoriza publicar centros, indexar el directorio, crear AMPAs reales ni abrir el piloto.
