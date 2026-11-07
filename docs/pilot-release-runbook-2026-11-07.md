# Wetudy · Runbook de integración del piloto (borrador)

**Fecha:** 7 de noviembre de 2026  
**Estado:** preparación; **ningún despliegue de este desarrollo en producción**.

## Estado comprobado

- **#233:** seguridad, permisos de informes, métricas AMPA y alertas educativas.
- **#236:** subida de fotografías a través del servidor, saneamiento, RLS Storage y cuota atómica.
- **#238:** optimización WebP/JPEG sobre #236 (reemplaza #237).
- **#239:** compatibilidad entre fotografías optimizadas y familias multico­legio (reemplazará #235 cuando sea seguro).
- **#240:** integración FANPA sobre #239 (reemplazará #234 cuando sea seguro).
- La rama #240 ha superado `Critical contracts`, `FANPA database isolation` y Vercel Preview.
- Fotografía de **un anuncio nuevo:** el archivo se sube al espacio temporal de su propietario **antes** de insertar el anuncio; la comprobación que exige un anuncio ya existente solo se usa en edición.
- Supabase producción permanece con 10 cuentas, 5 anuncios, 10 fotografías y sin las nuevas tablas/migraciones.

### Advertencia de dependencias

No integrar indiscriminadamente todas las migraciones SQL por orden de nombre y publicar la web sin comprobar las dependencias. En particular:

- La ruta `/api/uploads/sanitized-photo` **requiere** que exista la RPC `claim_photo_upload_slot`; si falta, devuelve 500 y no permite adjuntar imágenes.
- El envío manual de informes **requiere** `claim_school_manual_report_slot`.
- El panel FANPA **requiere** las tablas `federations`, `federation_schools`, `federation_admins` y el rol `fanpa_admin`.
- La política `20261107233000_server_photo_upload_policies.sql` impide las subidas directas desde el navegador; si se aplica antes de publicar y probar el nuevo frontend, corta la publicación de fotos y mensajes con imágenes.
- El límite de 5 MB y exclusión de GIF en el bucket deben sincronizarse con la interfaz para no rechazar operaciones de la web antigua.

## Verificación de consistencia de borradores y archivos (7/11/2026)

- Se detectó que el guardado o eliminación de un borrador podía borrar fotos **antes** de confirmar la modificación correspondiente en PostgreSQL.
- Se corrigió el orden de las operaciones: primero se confirma el cambio o la eliminación de la fila de borrador; después se limpian los archivos sin uso.
- Los borradores pueden almacenar fotografías utilizadas después por un anuncio publicado. Antes de retirar cualquier archivo, el servidor consulta `listings.photos` y **conserva** los que aún se utilizan; ante un error de la consulta también los conserva.
- Se añadieron diez pruebas de comportamiento con dobles de base de datos y Storage que simulan fallos al guardar, borrar o consultar referencias. No son pruebas con Supabase real.
- **Pendiente:** al eliminar definitivamente anuncios, el endpoint actual elimina registros relacionados pero **no elimina sus fotografías de Storage**. No activar ningún borrado masivo automático sin analizar referencias históricas, documentos y operaciones archivadas; tratar la limpieza de huérfanos como una revisión separada y segura.
- **Pendiente:** ejecutar al menos una prueba manual autenticada de guardar/publicar un borrador, descartar otro y confirmar que las fotografías publicadas siguen mostrando la imagen correcta.

## Fase A: validación PREVIA sin alterar producción

1. Releer todas las migraciones en orden cronológico y simularlas en PostgreSQL temporal. No aplicar a producción en esta fase.
2. Verificar el commit exacto en GitHub/Preview y éxito de `Critical contracts`, `Photo upload quota isolation`, `Server-only photo storage policies`, `Listing school association isolation` y `FANPA database isolation` según corresponda.
3. Realizar pruebas autenticadas de aceptación con **cuentas ficticias** en un entorno aislado. No usar familias reales ni crear actividad de demostración en producción sin autorización.
4. En fotos de móvil comprobar JPG/PNG/WEBP, EXIF/GPS eliminado, orientación, visibilidad de ISBN/texto, fotos múltiples, fotografías de chat, borradores recuperados y errores de subida.
5. Verificar que un usuario no puede publicar con el colegio de otra familia ni consultar estadísticas de centros ajenos.
6. Validar que un usuario con un estudiante desactivado no sigue recibiendo alertas educativas obsoletas.

## Fase B: preparar datos y servicio ANTES de publicar interfaz nueva

Solo tras aprobación expresa del propietario y copia de seguridad:

1. Crear y comprobar las dependencias compatibles con la web antigua:
   - `20261107222000_school_manual_report_atomic_quota.sql` (RPC de informes).
   - `20261107235000_photo_upload_rate_limit.sql` (RPC de fotografías).
   - `20261107192000_fanpa_federations_foundation.sql` (tablas y roles FANPA).
   - `20261107210000_listing_school_association_guard.sql` (trigger de colegio; comprobar que no bloquea la web anterior).
   - `20261107170000_pilot_privileges_photo_limit.sql`: **separar temporalmente la revocación TRUNCATE del cambio de límite/MIME** si la versión antigua de la web aún admite fotos de hasta 10 MB o GIF.
2. Comprobar mediante SQL SELECT que existen tablas, RPC, permisos y restricciones previstos, sin escribir datos de familias.
3. Comprobar recuperación/rollback de migraciones reversibles y un plan de intervención si falla la publicación.

## Fase C: desplegar código y comprobarlo

1. Desplegar el código revisado sin activar todavía la política que bloquea las subidas directas antiguas.
2. Verificar en navegador autenticado que la web nueva sube imágenes del borrador, crea el anuncio y muestra las fotografías.
3. Comprobar edición, PDF/Word por chat, imagen WebP por chat, código ISBN y publicación de una familia con centros A/B.
4. Confirmar logs de errores, respuesta HTTP 429 de cuota y ausencia de envíos de correos involuntarios.

## Fase D: cierre definitivo de Storage

1. Aplicar `20261107233000_server_photo_upload_policies.sql` **solo cuando el nuevo código haya sido probado en vivo**.
2. Aplicar el límite 5 MB/MIME del bucket y verificar que no impide documentos o fotos válidas.
3. Probar que una subida directa desde el cliente a `listing-photos` y una subida directa de imagen a `chat-attachments` son rechazadas.
4. Confirmar que el servidor sigue pudiendo publicar imágenes JPEG/WebP y que las fotos existentes se muestran.

## Pruebas de aceptación (aún NO E2E ejecutadas)

| ID | Escenario | Resultado requerido |
|---|---|---|
| A01 | Familia autenticada crea borrador con dos fotos | Se guardan sin EXIF, recuperables tras entrar de nuevo |
| A02 | Publicación desde fotos recién seleccionadas, sin borrador previo | Anuncio creado, imágenes accesibles (sin 403 por anuncio inexistente) |
| A03 | Publicación desde borrador previo | Fotos se conservan y no se borran tras limpiar borrador |
| A04 | Error durante carga de imagen | UI informa error, no crea operación fingida ni comunica éxito |
| A05 | Edición de anuncio propio | Nuevas imágenes se optimizan, se mantiene titularidad |
| A06 | Edición de anuncio ajeno | Denegada |
| A07 | Fotos de chat entre participantes | Archivo privado; solo conversación autorizada |
| A08 | PDF/Word por chat | Conserva funcionalidad y límite independiente |
| A09 | Foto con orientación EXIF / GPS | Orientación correcta, metadatos ausentes |
| A10 | Libro con ISBN y letra pequeña | Información legible tras optimización |
| A11 | 12+ cargas por cuenta / 10 minutos | 429 a partir del límite, incluso en concurrencia |
| A12 | Familia con dos estudiantes en colegios A/B | Puede elegir A o B para anunciar |
| A13 | Filtro «Solo mi comunidad» | Incluye anuncios A/B; distancia sin filtro incluye A/B y externos |
| A14 | Desactivar estudiante/cambiar colegio | Alertas educativas antiguas pausadas; sin reactivación obsoleta |
| A15 | FANPA | Indicadores agregados deduplicados; acceso por colegio limitado al conjunto asignado |

Los contratos estáticos, las pruebas unitarias y los PostgreSQL temporales no equivalen a ejecutar A01–A15 con un navegador autenticado y almacenamiento real.

## Rollback

- Conservar el commit original de producción hasta aprobar el corte.
- Si la web nueva falla antes del cierre Storage, revertir el despliegue a la versión anterior (la política antigua sigue permitiendo subir).
- Si falla tras cerrar Storage, **restaurar previamente una política temporal controlada o corregir el endpoint antes de revertir la web**, porque una reversión de frontend sin restaurar permisos de Storage bloquearía cargas.
- Mantener siempre las fotografías existentes, los cinco anuncios y los datos reales de usuarios; ninguna limpieza destructiva está autorizada por este runbook.

## Condiciones de GO/NO-GO

**NO-GO** si no han pasado los flujos E2E autenticados, si falta una RPC, si las políticas Storage no se han validado, si aparecen permisos cruzados entre colegios o si no existe plan de reversión probado. No afirmar que el piloto está listo por el simple éxito de CI.
