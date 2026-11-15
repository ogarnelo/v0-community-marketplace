# WETUDY — PR551 · Fallos de lectura escolar en el editor de anuncios
15/11/2026. Sin cambiar SQL productivo ni datos de familias.

El editor de anuncios de main consultaba el colegio local, fotografías del anuncio y directorio nacional después de verificar que el usuario fuera vendedor. Pero solo comprobaba el error de `listing_photos`: si `schools` o `school_directory` fallaban (por RLS, conectividad o error del proveedor), el formulario mostraba falsamente `Centro no asignado` o un nombre escolar obsoleto. También propagaba los objetos de error SQL de listings/photos hacia SSR.

La corrección captura `schoolError` y `directoryError` y aborta con identificadores genéricos, diferenciando datos realmente ausentes de una consulta fallida; no muestra detalles del proveedor. Se preservan las consultas de fotos con rol autenticado y la comprobación de propiedad antes del directorio privilegiado. Ocho pruebas runtime TypeScript/TSX simulan un usuario sin acceso, UUID inválido, fallos de cuatro tablas y éxito en el directorio.

No se solicitan ni se utilizan datos reales, no se amplían permisos y no se habilita el piloto. #245: 0/3 AMPA; recuperación integral pendiente y gestión de copias fijada el 17/11.
