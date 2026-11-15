# WETUDY — PR562 · Eliminación de anuncios sin pérdida del historial ni fotos
15/11/2026. **P0 integridad/privacidad**, sin migraciones ni uso de datos privados de producción.

## Fallos descubiertos
La ruta `app/api/listings/delete/route.ts` ejecutaba cinco comprobaciones privilegiadas en paralelo, pero ignoraba sus campos `error`. Si una fallaba, podía tratar la ausencia de respuesta como historial vacío y **eliminar un anuncio con transacciones, reportes o conversaciones existentes**. Tampoco comprobaba acuerdos, envíos, reseñas, moderación, incidencias o promociones. Además ejecutaba `Promise.allSettled` para eliminar `favorites`, `listing_photos` y `listing_views` **antes** de intentar borrar la fila `listings`, de modo que si el DELETE fallaba la ficha conservada perdía fotografías y favoritos. El catch reflejaba `error.message` SQL a la respuesta HTTP.

## Evidencia SQL de solo lectura
Se han inspeccionado las claves foráneas de `public.listings` y comprobado en producción que `listing_photos`, `favorites` y `listing_views` utilizan `ON DELETE CASCADE`; los historiales de conversaciones, pagos, acuerdos, envíos, reseñas, donaciones, informes, boosts y otros tienen dependencias adicionales. Se han verificado las columnas `id,listing_id` de once tablas de historial. No se han leído filas de familias ni ejecutado SQL mutador.

## Solución
Autenticación con error separado de invitado (503 vs 401); UUID validado antes de servicio privilegiado; comprobación explícita `seller_id === user.id` antes de cualquier efecto. Se comprueban operaciones bloqueantes (pagos en estados críticos, ofertas aceptadas, donaciones aprobadas) para devolver 409, se inspeccionan once tablas de historial, y **si cualquiera falla se aborta con 503 sin cambiar nada**. Con historial se archiva mediante UPDATE condicionado a propietario y con `select('id').maybeSingle()` confirmando la fila, sin borrar relaciones. Solo si ninguna fila de historial ni error aparece se permite DELETE del anuncio condicionado a propietario, con devolución de ID y verificación. Las FK de PostgreSQL gestionan los dependientes: nunca se eliminan las fotos/favoritos/vistas antes de confirmar DELETE. Todo error responde genérico y con `Cache-Control: private,no-store`.

## Pruebas y límites
Pruebas HTTP del handler real con SQL sintético: usuario invitado/ajeno, UUID, errores, 11 tablas de historial presentes y fallidas, 3 bloqueos comerciales, archivo y DELETE confirmados, fallos y cero filas. No se han borrado anuncios, fotos ni favoritos reales. **Limitación de concurrencia**: operaciones comerciales iniciadas entre la comprobación de historial y el DELETE son una posible carrera; cerrarla completamente requeriría transacción/locking en PostgreSQL y migración controlada, no autorizada en esta tanda. El borrado físico de objetos de Storage, distinto del cascade de sus registros, queda fuera de esta PR y requiere limpieza separada con criterios de retención.

Piloto general NO-GO; E2E autenticado real, recuperación integral y aceptación AMPA 0/3 pendientes. Gestión de respaldos 17/11.
