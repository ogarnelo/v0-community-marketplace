# WETUDY — Verificar que el backup cifrado contiene los bloques críticos

Fecha: 10/11/2026 · Piloto · Incidencia P0 #375.

## Nuevo control independiente del contenido de las familias

Tras descargar y descifrar la copia **únicamente dentro del runner de GitHub Actions**, el ensayo de recuperación existente extrae `pg_restore --list` a un archivo temporal protegido. El verificador `scripts/pilot-db-backup-critical-toc.py` comprueba que el catálogo contiene las secciones `TABLE` y `TABLE DATA` para las entidades indispensables:

- familias y permisos: perfiles, alumnos, roles;
- anuncios y ofertas: listings, fotos y ofertas;
- comunicaciones: conversaciones, mensajes y notificaciones;
- transacciones: acuerdos, pagos e intentos;
- búsqueda cercana por código postal y alertas: centroides postales, outbox, búsquedas guardadas, coincidencias y recibos.

La comprobación **no inspecciona filas**, no imprime mensajes ni emails, no crea cuentas y no escribe en producción. Registra por separado si el TOC menciona las tablas administradas `auth.users`, `auth.identities` y `storage.objects`, sin considerarlas restauradas por su sola presencia.

Se integra en `pilot-db-restore-drill.sh`, que sigue restaurando **solo un subconjunto no personal del directorio de colegios** en una base PostgreSQL 17 local y desechable. La CI `Wetudy combined encrypted backup recovery check` se ejecuta también ante cambios al nuevo verificador.

## Lo que NO se puede concluir

- Que todas las filas, archivos físicos y claves pueden restaurarse.
- Que Auth, SMTP, Storage o funciones están reconstruidos.
- Que la copia cifrada y su clave estarán disponibles después de siete días.
- Que las cinco migraciones de alertas son aptas para producción sin otras puertas.

Para validar estos puntos faltan ensayos de recuperación de alcance completo (sin exposición de datos reales), procedimientos de contingencia y autorización de aplicación controlada. No activar correos ni cerrar #375.

## Cobertura adicional: todas las tablas públicas

Se amplía el mismo control de metadatos para exigir **TABLE + TABLE DATA de las 79 tablas públicas** inventariadas el 10/11 (158 entradas de catálogo), no solo las 18 críticas. La lista se reutiliza de `pilot-dr-scope-audit.py` para evitar divergencias. Si se crea o elimina una tabla y el inventario deja de coincidir con Supabase, hay que actualizarlo tras una consulta de solo lectura. La existencia de las 158 entradas en el catálogo **no demuestra que cada tabla contenga filas ni que se pueda restaurar íntegramente**.
