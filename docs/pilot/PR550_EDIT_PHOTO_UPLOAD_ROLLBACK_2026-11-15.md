# WETUDY — PR550 · Limpieza de fotografías nuevas ante fallo en edición
Fecha 15/11/2026; alcance: formulario editor, sin modificar tablas ni datos productivos.

## Hallazgo
Al editar un anuncio, el helper `uploadNewPhotos` sube archivos nuevos a Supabase Storage y posteriormente incorpora filas `listing_photos`. Si falla la segunda subida, se pueden quedar objetos huérfanos. La edición previamente recibió un control de propiedad y confirmación de filas (#547), pero el rollback de subidas anteriores a INSERT seguía pendiente.

## Cambio
Conservar únicamente los paths que esta operación acaba de subir correctamente; ante fallo posterior de subida o de URL pública, eliminarlos usando el cliente de sesión del propietario. Los paths de fotografías existentes del anuncio no forman parte de la lista de limpieza. No reflejar diagnósticos de Storage en UI ni consola; retornar error constante. **No** eliminar nuevas fotos ante un resultado ambiguo posterior a INSERT de `listing_photos`: podría haber filas que las referencien; requiere conciliación transaccional específica.

## Pruebas
Cinco pruebas de ejecución del helper TypeScript real comprueban: éxito con `sort_order`, segundo fallo, URL inexistente, fallo de limpieza y primer fallo sin borrados. Se ejecutan en Critical contracts y no tocan archivos o cuentas de familias.

La migración ACL permanece intacta y no se tocan los defaults administrados por Supabase. Piloto AMPA sigue 0/3 y DR integral pendiente. NO-GO apertura.
