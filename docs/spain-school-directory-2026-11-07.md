# Directorio nacional de centros educativos — Wetudy
**Preparado el 7 de noviembre de 2026. NO importado ni publicado en producción.**

## 1. Datos del archivo aportado
- Archivo original: `listado_centros.xls` (BIFF8 / Excel clásico).
- Filas leídas: **34.840**; contiene **una cabecera repetida** y por tanto **34.839 centros nacionales válidos**.
- Centros únicos por código oficial de 8 dígitos en el nacional: **34.839**. **0 duplicados**.
- Comunidades y ciudades autónomas cubiertas: **19** (17 comunidades, Ceuta y Melilla).
- Provincias: **52**.
- Columnas de origen: comunidad, provincia, localidad, denominación genérica/específica, código, naturaleza, domicilio, CP, teléfono.
- El archivo no documenta una **fecha verificable de actualización** ni su licencia. Su exactitud y condiciones de reutilización deberán confirmarse antes de publicarlo como fuente oficial.

## 2. Conciliación con Galicia
- Directorio provincial existente: **1.624** registros.
- Coinciden por código con el nacional: **1.618**.
- **6** códigos solo en la fuente provincial: se conservan como candidatos **pendientes de revisión de vigencia**.
- **45** códigos solo en el nacional dentro de Galicia: se conservan sin asumir que son necesariamente nuevos.
- Catálogo combinado: **34.845** códigos únicos.
- **1.613** registros de Galicia tienen coordenadas aprovechables; los otros **33.232** no deben mostrarse con una posición inventada.
- **5.552** registros nacionales sin denominación genérica/tipología, concentrados en Cataluña: no inventar su etapa educativa.
- Los **77** registros que carecen de denominación específica usan provisionalmente su denominación genérica, no un nombre inventado.

## 3. Espacio / coste
- Producción Wetudy: `pg_database_size` ≈ **22 MB** antes de importar.
- PostgreSQL 17 efímero de GitHub Actions: **34.845 filas sintéticas consumen 14 MB** incluyendo la tabla e índices (`pg_total_relation_size`). No equivalen exactamente al tamaño de los datos reales.
- Total aproximado esperable: **36 MB**, con margen para variaciones, sobre **500 MB** disponibles en Supabase Free.
- No requiere un nuevo proyecto, servicio de geocodificación, almacenamiento Storage ni plan Pro.
- El CSV importable sin teléfonos pesa aprox. **8 MB** en disco antes de comprimir; archivo fuente y datos de contacto se excluyen de los resultados públicos.

## 4. Estrategia técnica de bajo coste
- Se amplía la **PR #242** del directorio gallego al nacional.
- La tabla `public.school_directory` está separada de `public.schools` (centros operativos).
- `official_code` es PK, el resto se preserva como texto/latitud-longitud cuando existen.
- Campo `autonomous_community` y filtros por región, provincia, municipio, nombre, CP y código oficial.
- `is_listed=false` por defecto, RLS activa, sin SELECT directo para roles de navegador. El endpoint devuelve solo registros aprobados.
- Paginación de **24** centros por respuesta. No precargar 35.000 filas en el navegador.
- `linked_school_id` solo puede asignarse después de verificar manualmente la vinculación con una comunidad Wetudy. La importación no crea cuentas AMPA, códigos de adhesión ni alertas automáticas.
- Los 6 registros exclusivos de Galicia están señalados en `review_status` para no darlos por vigentes sin revisión.

## 5. Archivos de importación preparados fuera del repositorio
- `01_catalogo_espana_34845_preparado.csv`: catálogo completo, estatus no publicado.
- `02_importacion_postgres_34845_no_publicar.csv`: columnas que coinciden con la tabla SQL de #242, conserva `review_status`; **no contiene teléfonos**.
- `03_galicia_solo_fuente_regional_6.csv` y `04_galicia_solo_fuente_nacional_45.csv`: revisión de diferencias.
- Resúmenes por comunidad, provincia, categoría y errores.
- No subir los CSV masivos al repositorio por defecto: evitar inflar Git, cambios de datos opacos y despliegues accidentales.

## 6. Orden de activación futura — requiere autorización
1. Confirmar procedencia, fecha y licencia del listado nacional y vigencia de los centros en revisión. No etiquetarlo como directorio oficial actualizado sin esa comprobación.
2. Aprobar el alcance de publicación informativa y la advertencia de no adhesión; **no** activar automáticamente centros.
3. Aprobar y aplicar la migración SQL aislada #242.
4. Cargar CSV en lotes controlados mediante cliente de base de datos con permisos de servicio, preservando `official_code` y evitando duplicados; validar 34.845 filas y 0 enlaces automáticos. **No invocar esta carga desde la web pública**.
5. Verificar muestras de las 19 regiones, paginación, CP, términos literales y que los 34.845 registros siguen `is_listed=false`.
6. Habilitar progresivamente la visibilidad de registros informativos tras la aprobación. La página `/centros` distingue claramente el catálogo de las comunidades adheridas.
7. Por separado, diseñar el selector de colegios de los estudiantes. En este momento utiliza exclusivamente `public.schools`; es incorrecto asumir que #242 permite asociar automáticamente a los alumnos con cualquier entrada del catálogo.
8. Monitorizar tamaño en `pg_total_relation_size('public.school_directory')`, tiempos de consulta y uso de caché tras publicar.

## 7. Estado de validación
- Tests de calidad de CSV local: 34.845 únicos, 19 regiones, 52 provincias, 0 teléfonos en archivo de importación.
- GitHub Actions en PostgreSQL temporal: inserción sintética de 34.845 filas, PK, RLS, publicación desactivada y medida de **14 MB**.
- GitHub Critical Contracts y Vercel Preview verificados para el commit de pruebas de la PR #242.
- **No hay prueba E2E autenticada ni importación en producción.**
