# WETUDY — PR546: confirmación de escritura y alcance de fotos al editar
Fecha 15/11/2026. Parche mínimo de main sin SQL productivo ni cambios de autorización.

## Hallazgo concreto
El formulario de edición actualizaba `listings` y solo revisaba `error`: PostgREST puede devolver éxito con 0 filas afectadas si el anuncio dejó de pertenecer al usuario, fue eliminado o cambió su RLS. En ese caso el formulario seguía borrando/ordenando fotos, e incluso redirigía como si se hubiera guardado. La eliminación de fotografías se filtraba por sus IDs sin confirmar el listing_id correspondiente, dependiendo exclusivamente de la RLS de la tabla.

## Corrección
Tras `UPDATE listings`, añadir `.select('id').maybeSingle()` y exigir fila confirmada antes de operaciones sobre fotos. La operación DELETE de `listing_photos` añade `.eq('listing_id',initialListing.id)` antes de los IDs seleccionados. La sincronización final de las URLs también exige `.select('id').maybeSingle()` y fila afectada antes de navegar al anuncio. El mensaje de error sigue genérico, sin datos SQL. No cambia campos editables, validación de fotos ni aspecto.

## Pruebas
Cinco contratos en `__tests__/launch/pilot-edit-listing-write-confirmation-contract.test.mjs`: TSX válido, escritura propia y confirmada antes de fotos, supresión cross-listing, segunda confirmación de sync y privacidad de errores. Critical contracts + preview Vercel obligatorios antes de merge. Una prueba de contrato no sustituye una sesión autenticada real.
## Estado
#245 0/3 AMPA, DR integral pendiente, gestión de respaldos 17/11 según decisión. Sin tocar grants internos supabase_admin ni 14 tablas MAINTAIN fuera de autorización. NO-GO general.
