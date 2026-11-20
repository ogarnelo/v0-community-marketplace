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

## Importador original recuperado, sin ejecutar

- `scripts/import_school_directory.py` y `scripts/test_import_school_directory.py` se recuperan de la PR #242 como herramienta de validación y recuperación puntual; **el importador no se ejecuta en producción durante esta PR**.
- Por defecto valida localmente un CSV de 34.845 centros mediante SHA-256 obligatorio, esquema de columnas estricto (sin teléfonos, roles, `is_listed`, `seo_indexable` ni `linked_school_id`) y unicidad de códigos. No abre conexión con Supabase en modo normal.
- La ruta de escritura solo existe tras `--apply` explícito, `--project-ref` correcto, variable de autorización específica y credenciales privadas del servicio. Está bloqueada si ya hay centros publicados.
- Pruebas unitarias de Python ejecutadas sin red desde `critical-contracts`; ensayo de reconstrucción completo con **34.845 registros ficticios** en PostgreSQL 17 aislado en `pilot-school-directory-cold-restore-pg17.yml`.
- Los CSV originales y su licencia/vigencia NO están versionados en GitHub, y la tabla real ya contiene 34.845 registros. Para restaurar los datos harían falta la copia controlada del archivo original o los respaldos existentes; **no se generan datos ficticios en Supabase**.

Esta recuperación no autoriza una recarga de producción ni una actualización editorial. Para futuras versiones del catálogo debe diseñarse un procedimiento separado, ya que el importador mantiene un recuento y manifiesto exactos como salvaguarda.
