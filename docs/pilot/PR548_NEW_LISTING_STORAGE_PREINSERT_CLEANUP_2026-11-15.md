# WETUDY — PR548 · Limpieza de subidas fallidas antes de crear el anuncio
15 de noviembre de 2026. Cambio limitado al formulario de publicación y su helper de fotos. No toca datos reales.

## Problema
El publicador sube hasta 8 fotografías a Supabase Storage **antes** de insertar un anuncio en PostgreSQL. Si la segunda o posterior subida falla, la primera ya está almacenada pero no hay aún una fila `listings` que la referencie. Sin limpieza, se acumulan archivos de familias huérfanos. Además puede reutilizar imágenes de un borrador: estas nunca deben borrarse durante un rollback de nuevas subidas.

## Solución
El helper `uploadListingPhotos` registra únicamente los paths de Storage subidos correctamente durante la operación actual. Si falla otra subida o la obtención de una URL antes del INSERT, solicita eliminar **solo esos nuevos objetos** con el cliente de sesión del propietario. No elimina `photo.storagePath` reutilizado del borrador, ni altera fotos de otros anuncios ni de otros usuarios. La excepción externa es siempre un identificador fijo; si Storage rechaza la limpieza, el log contiene solo un token, sin rutas o datos privados.

Los cambios no intentan borrar fotos después de un INSERT ambiguo de anuncio: en ese momento podría existir una fila publicada que las referencie, por lo que sería inseguro eliminar sus archivos sin confirmar el estado real. La recuperación ante INSERT parcial queda pendiente de diseño transaccional específico, no se afirma resuelta.

## Evidencia
`__tests__/launch/pilot-new-listing-photo-preinsert-rollback-runtime.test.mjs`: cinco tests del helper TypeScript real en un contexto Node sintético (éxito, fallo segunda subida, URL ausente, error en limpieza y fallo primera subida), integrados en Critical contracts. CI y preview Vercel obligatorios antes del merge.

#245 continúa 0/3 AMPA, DR parcial anterior conservada y respaldos previstos por responsable el 17/11. Default ACL de supabase_admin administrado por plataforma, sin intentos de elevar permisos; 18 MAINTAIN fuera de autorización permanecen intactos. NO-GO apertura.
