# WETUDY · Ensayo aislado de recuperación de búsquedas guardadas y proximidad

Fecha: 11 de noviembre de 2026. Incidencia P0 #375.

## Qué se comprueba

Una nueva prueba usa **solo filas sintéticas** y PostgreSQL 17 en el runner de GitHub. Reconstruye mediante `pg_dump -Fc` / `pg_restore` la relación entre dos perfiles de prueba, anuncios, preferencias de código postal, centroides, búsquedas guardadas (radio de 10 km), coincidencias, outbox y recibos externos simulados.

Antes y después de restaurar compara huellas agregadas de todas las filas para ocho tablas de prueba, y verifica las relaciones entre comprador, anuncio, búsqueda, estado del trabajo y recibo.

Cinco alteraciones deliberadas en **la base restaurada y desechable** deben detectarse: CP sin centroide, coincidencia con usuario incorrecto, recibo sin ID externo, outbox en fallo y coincidencia sin marca de email enviado. Tras cada alteración se comprueba que la restauración original vuelve a ser íntegra.

Las estructuras imitan solo columnas elegidas y comprobadas mediante introspección de Supabase el 11/11/2026. No son las migraciones productivas completas y no prueban el cálculo geográfico real. El cálculo de distancia y el uso de códigos postales siguen siendo aproximados por centroide.

## Garantías y límites

- La URL debe apuntar a `127.0.0.1`, `localhost` o `::1` y a la base desechable prevista.
- Ningún contacto con Supabase de producción, Resend, emails reales ni servicios de cobro.
- No recupera usuarios reales de GoTrue, Storage gestionado, ni mensajes reales.
- No aplica las cinco migraciones pendientes ni habilita cron/flags.
- No demuestra aún una restauración integral de los 79 objetos de negocio: prueba un recorrido sintético.
- Mantener los seis anuncios DEMO y #375 sin cerrar.

El ensayo se añade al workflow existente `Wetudy synthetic local PostgreSQL and Storage combined recovery`, separado del ensayo de copia cifrada real (que solo restaura un directorio no personal).
