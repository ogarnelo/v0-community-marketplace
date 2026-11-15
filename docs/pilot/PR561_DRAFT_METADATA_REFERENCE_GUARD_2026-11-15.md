# WETUDY — PR561 · Protección complementaria de fotos que siguen referenciadas
15/11/2026. No se ejecutan migraciones ni se tocan objetos reales de Storage.

Tras PR559, la limpieza de borradores verificaba `listings.photos`, pero podía no encontrar una foto cuyo URL aún estuviera en una fila `listing_photos` cuando un editor había dejado el array temporalmente desactualizado. Se añade la verificación de existencia `listing_photos.url` por cada URL canónico o persistido y se conserva la foto si cualquiera de las consultas devuelve error. Se consultan solamente IDs, después de autenticar al dueño del borrador, con respuesta privada y sin revelar referencias ajenas.

Se amplían las cinco pruebas previas de orden DB-before-Storage y las cuatro pruebas previas de referencias con cuatro nuevos escenarios del handler real: foto referenciada solo por fila en PUT/DELETE y fallo SQL de esa lectura en PUT/DELETE. Son **13 pruebas totales**, 4 nuevas, con sesiones y proveedores sintéticos.

Limitación explícita: no se elimina la carrera temporal entre verificación y borrado de Storage de dos sesiones/dispositivos. No se crea UNIQUE ni se modifica SQL productivo sin autorización. AMPA 0/3, E2E autenticado y DR integral pendientes. NO-GO.
