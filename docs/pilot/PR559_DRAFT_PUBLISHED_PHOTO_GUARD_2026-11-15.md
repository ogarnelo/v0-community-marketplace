# WETUDY — PR559 · Conservar fotografías de borradores utilizadas por anuncios publicados
15/11/2026. Cambio de integridad del borrador, **sin ampliación de permisos, DDL ni modificación directa de filas productivas**.

## Hallazgo
El publicador permite reutilizar una imagen de borrador `<user>/drafts/...` y guarda su URL en `listings.photos`. Aunque PR543/544 hacen primero el commit de `listing_drafts` y luego la limpieza Storage, `PUT /api/marketplace/listing-draft` y `DELETE /api/marketplace/listing-draft` seguían pudiendo borrar esa foto publicada cuando una actualización/descarte no conservaba correctamente `preservePhotoPaths` desde el navegador.

## Solución
Antes de eliminar un path de Storage, el servidor vuelve a comprobar si el enlace de esa foto aún figura en el array de fotografías de **algún** anuncio `public.listings.photos`. Usa el URL público canónico obtenido con `getPublicUrl(path)` y el URL almacenado en el borrador; para cada posible coincidencia consulta únicamente `id` mediante `.contains('photos',[url]).limit(1).maybeSingle()`. Si una referencia existe, **no borra** el path. Si el proveedor responde error o el URL no puede verificarse, conserva el archivo y marca `cleanupPending`; nunca confunde error con inexistencia. Se mantienen `cleanPhotos` (prefijo userId/drafts, máximo 8) y el orden DB commit antes de Storage.

No se expone ninguna información sobre quién referencia la URL ni se realiza lectura de filas para responder al usuario; el resultado es solamente el conjunto de paths eliminables. El criterio es deliberadamente conservador: puede dejar archivos huérfanos, pero evita borrar fotografías publicadas. **Límite**: una referencia creada entre la comprobación y la eliminación sigue siendo una carrera entre servicios; requiere diseño transaccional/retención adicional.

## Regresión
Se extienden pruebas runtime del handler: los cinco escenarios previos de PUT/DELETE y cuatro casos adicionales: conservar foto referenciada en PUT/DELETE, fail closed en error SQL antes de DELETE Storage y retorno `cleanupPending`. El funcionamiento bajo sesiones auténticas y las carreras entre pestañas no quedan certificados aquí.

El piloto general continúa NO-GO, AMPA 0/3, E2E real y DR integral pendientes. Gestión de respaldos día 17/11 según decisión. No se tocan `supabase_admin` ni privilegios MAINTAIN externos al alcance autorizado.
