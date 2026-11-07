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

## 8. Confirmación del origen por el promotor (7/11/2026)

El promotor confirma expresamente que `listado_centros.xls` **procede del Ministerio de Educación** y está **vigente**. La procedencia y la vigencia se consignan como declaraciones del promotor: el XLS no incluye enlace específico de descarga ni sello temporal de extracción. No deben inventarse una fecha de publicación, un número de versión o una licencia. El Ministerio mantiene el Registro estatal de centros docentes no universitarios: https://www.educacionfpydeportes.gob.es/servicios-al-ciudadano/catalogo/estudiantes/donde-estudiar/registro-centros-no-universitarios.html. La atribución de la fuente será visible cuando se publique el directorio.

Se ha generado un segundo CSV, derivado del archivo normalizado anterior, que refleja la información confirmada sin descartar incidencias de calidad:

- **29.210** entradas nacionales con vigencia declarada por el promotor.
- **5.552** entradas vigentes, pero con la tipología sin especificar.
- **77** entradas vigentes con denominación específica ausente (denominación genérica provisional).
- **6** entradas disponibles únicamente en la fuente gallega: conservar y contrastar por separado, sin afirmar su presencia en el extracto ministerial.
- **Total: 34.845 códigos oficiales únicos.** Las cuatro categorías son mutuamente excluyentes.

El CSV de importación actualizado se encuentra en el paquete descargable del promotor, **no en GitHub ni en Supabase**:
`10_importacion_ministerio_confirmada_34845_NO_PUBLICAR.csv`.

**SHA-256 del archivo exacto:** `7e499aa52ee5742dedbff51d596dd6c5ef3e706ae3e59ae775205083ad50a777`.

## 9. Importación controlada y reanudable (PREPARADA; NO EJECUTADA)

El importador `scripts/import_school_directory.py` utiliza exclusivamente la biblioteca estándar de Python. Sin argumentos especiales ejecuta **solo una validación local** (dry-run, sin acceso a la red ni a Supabase). Comprueba:

1. SHA-256 exacto, 34.845 filas, cabeceras aprobadas sin teléfonos, códigos únicos de ocho dígitos y CP de cinco dígitos.
2. Comunidades reconocidas, campos obligatorios y coordenadas verificables cuando existan.
3. El recorrido de solo lectura se completa sin necesidad de credenciales.

Ejemplo de validación **segura y local**:

```bash
python3 scripts/import_school_directory.py \\
  10_importacion_ministerio_confirmada_34845_NO_PUBLICAR.csv \\
  --sha256 7e499aa52ee5742dedbff51d596dd6c5ef3e706ae3e59ae775205083ad50a777
```

Solo cuando el propietario **autorice específicamente crear la tabla e importar en la base real**, y después de comprobar copia de seguridad, se permitirá `--apply`. El programa exige simultáneamente la referencia del proyecto Wetudy, la variable de aprobación `WETUDY_DIRECTORY_IMPORT_APPROVED=SI_AUTORIZO_IMPORTACION_NACIONAL`, `SUPABASE_URL` con el proyecto esperado y `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en un entorno seguro. Nunca introducir estas credenciales en GitHub, en el navegador, en un archivo compartido ni en los logs.

- **175 lotes de hasta 200 centros**, sin subidas masivas en una única petición.
- Estrategia idempotente: `on_conflict=official_code` y `resolution=ignore-duplicates`; los centros existentes no se sobrescriben ni se duplican.
- Los datos enviados **no incluyen** `is_listed` ni `linked_school_id`; la DB aplica sus valores por defecto `false` y `null`.
- La herramienta rechaza importaciones si detecta centros ya publicados; verifica recuentos finales y que las entradas publicadas siguen siendo **cero**.
- Error de lote → se detiene la carga. Repetir el mismo archivo y huella es seguro para registros ya importados. No activa comunidades escolares ni cuentas.
- Batería `scripts/test_import_school_directory.py`: pruebas unitarias de validación, duplicados, aprobación, secreto, idempotencia y ausencia de publicación, ejecutadas en GitHub Actions sin conexión externa.

**IMPORTANTE:** esta preparación **no constituye autorización para escribir en producción**. La PR #242 permanece en borrador y el selector de colegios para alumnos todavía requiere integración específica.

## 8. Código público y QR por colegio — añadido a PR #242

El identificador oficial de cada centro es su código ministerial de 8 dígitos.
Wetudy deriva un código **público, único, estable y sin almacenamiento adicional**: `WET-<codigo_oficial>` (por ejemplo `WET-36006122`). El código no es una contraseña ni habilita permisos. La unicidad se apoya en la PK por código oficial; no hay que generar 34.845 claves arbitrarias.

El QR se calcula bajo demanda mediante la dependencia `qrcode`, que el producto ya utilizaba, apuntando a `https://www.wetudy.com/centros/<codigo_oficial>`. Es descargable en PNG o SVG y se ofrece **solo si `is_listed=true`**. No se precalculan imágenes ni se almacenan 34.845 objetos en Supabase Storage. La caché CDN reduce el procesamiento repetido. El QR tampoco incluye información de familias, alumnos o tokens.

**Separar tres conceptos:**
- **Código oficial ministerial:** identifica de manera estable el colegio en los datos de origen.
- **Código Wetudy del directorio:** `WET-XXXXXXXX`, identificador público para fichas, materiales impresos y seguimiento.
- **Código/QR de incorporación de comunidad:** funciones existentes `school_access_codes` y `/api/school/share-qr` para centros activados, con sus propios controles de administradores. Un QR de directorio **no** equivale a una invitación a comunidad ni permite acceder a estadísticas AMPA.

## 9. Política de SEO: fase piloto y crecimiento

Crear una base de datos con 34.845 entradas **no mejora automáticamente el SEO**. Los buscadores solo obtendrán valor cuando las fichas aporten utilidad y una comunidad tenga materiales o actividad real.

- Añadimos el campo `seo_indexable boolean NOT NULL DEFAULT false`, independiente de `is_listed`.
- Una ficha debe estar publicada **y además** contar con autorización manual de indexación, asociación verificada a un colegio operativo, actividad activa y `is_test=false` para emitir `robots.index=true`. En los demás casos será `noindex, follow`, o responderá 404 si no está publicada.
- Cada ficha aprobada tendrá título, descripción y URL canónica con código oficial. No se atribuirán anuncios, precios, ahorro, asociaciones o consentimientos que no se hayan comprobado.
- **No generar ni incluir todavía los 34.845 URLs en el sitemap.** Más adelante, crear sitemaps únicamente de fichas con contenido real y aprobación editorial, enlazadas en navegación útil y agrupadas por provincia/comunidad.
- Google considera abusivo el contenido masivo sin valor para los usuarios: https://developers.google.com/search/docs/essentials/spam-policies
- Un sitemap facilita el descubrimiento, **no garantiza indexación**. https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

### Validación necesaria antes de habilitar indexación

Comprobar que el colegio participa realmente en Wetudy, que su ficha tiene contenido útil y correcto, que los anuncios de muestra no se presentan como reales y que las señales SEO son coherentes en el HTML servido al buscador. Revisar enlaces, canonicals y datos en Search Console. No indexar masivamente centros sin actividad. No usar datos estructurados `LocalBusiness` simulando que Wetudy es el operador de esos colegios.
