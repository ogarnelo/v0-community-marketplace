# Catálogo informativo de Galicia — límites, costes y activación

**Preparación del 7/11/2026. No ejecutar migración ni importación en producción sin aprobación expresa.**

## Cuánto cuesta

- Centros en los CSV provinciales del propietario: **1.624**; códigos oficiales únicos: **1.624**.
- Supabase Wetudy: `pg_database_size(current_database())` dio unos **22 MB**.
- Límite del proyecto Free en noviembre de 2026: **500 MB** de base de datos. El límite de **1 GB de Storage** es distinto y se destina a archivos/fotos, NO a estas filas.
- CSV original de catálogo sin teléfonos: **275.776 bytes**.
- CSV de importación preparado: **342.651 bytes** (incluye fuente de procedencia).
- PostgreSQL 17 temporal con **1.624 filas sintéticas** y los índices de la nueva tabla consumió **680 kB** según `pg_total_relation_size`. El conjunto real puede ocupar más o menos según la longitud de los nombres y direcciones: reservar **1–3 MB** es prudente.
- No hay una suscripción adicional ni otro proyecto: dentro de Free, el incremento estimado de almacenamiento es **0 €/mes**.

## Medidas de ahorro y seguridad

1. La tabla `school_directory` contiene texto y coordenadas; **nunca fotografías, logos ni teléfonos**. No se guardan documentos institucionales en Storage.
2. La API hace **paginación de 24** registros con búsqueda en servidor. La UI nunca descarga los 1.624 centros de golpe. Caché compartida de cinco minutos para resultados públicos.
3. `official_code` (8 dígitos) es la clave primaria, impidiendo duplicaciones de ese código.
4. RLS habilitada; `anon` y `authenticated` no pueden leer directamente la tabla. La API devuelve únicamente datos informativos de registros `is_listed=true`.
5. La asociación `linked_school_id` a la tabla `schools` es explícita y verificada. Nunca se infiere por nombre, calle o CP.
6. `is_listed=false` por defecto: **importar registros no los publica ni los activa como comunidades Wetudy**.

## Dependencias y pasos, aún no autorizados

1. Validar términos de reutilización/atribución de la fuente antes de publicar información.
2. Revisar los **11 centros sin coordenadas fiables** y las tipologías que requieren comprobación de etapas escolares. No excluir privados ni educación especial sin revisión.
3. Autorizar por separado la creación de la tabla (migración SQL), la carga de los 1.624 registros y la publicación progresiva, comenzando por Pontevedra.
4. La importación debe partir del archivo separado `school_directory_import_ready_1624.csv`, cuyo CSV no se incluye en la PR para evitar cargar datos a un repositorio o aplicar altas involuntarias.
5. Tras carga controlada, confirmar: 1.624 filas, 0 duplicados, 0 membresías creadas, 0 nuevos centros operativos y 0 entradas visibles hasta aprobación explícita.
6. Solo después enlazar la navegación al catálogo `/centros`. El selector actual de estudiantes sigue usando **únicamente centros operativos**: nunca presentar un directorio informativo como adhesión oficial.

## Comprobaciones ejecutadas sin datos reales

- PostgreSQL temporal: catálogo con 1.624 filas ficticias, índices y 680 kB medidos; bloquea duplicados de código, coordenadas intercambiadas y lectura por roles cliente.
- Pruebas JS de filtros, protección frente a patrones comodín, paginación, errores y obligatoriedad de `is_listed=true`.
- Preview Vercel: código navegable, pero la web de producción no tiene esta nueva tabla ni los 1.624 centros.

**Fuentes:** archivos provinciales facilitados por el promotor, y documentación oficial de Supabase sobre capacidad Free: https://supabase.com/docs/guides/platform/billing-on-supabase
