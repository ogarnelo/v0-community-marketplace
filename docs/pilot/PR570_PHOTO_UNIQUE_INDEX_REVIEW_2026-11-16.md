# WETUDY — PR570 · Garantía única para reparación de fotos entre pestañas (REVISIÓN, NO APLICAR)

Fecha: 16/11/2026 · **NO AUTORIZADA PARA PRODUCCIÓN**.

## Hallazgo comprobado de solo lectura
En Education Marketplace, `public.listing_photos` contiene **11 filas** y **0 pares duplicados** `(listing_id,url)`; el máximo por par es 1. No existe un índice UNIQUE que garantice lo mismo en futuras escrituras. `listing_id` es UUID nullable y `url` es TEXT NOT NULL. Dos reparaciones simultáneas del editor pueden repetir una misma URL pese al bloqueo por pestaña de PR560.

## Propuesta revisable
`scripts/p0_listing_photos_unique_review_only.sql`: BEGIN, lock_timeout 2 s, statement_timeout 15 s, comprobación PG17, RLS habilitado, forma de columnas, nombre de índice libre, ausencia de duplicados, índice UNIQUE parcial por `(listing_id,url) WHERE listing_id IS NOT NULL`, verificación de índice válido y COMMIT. Se conserva la posibilidad de URL igual en anuncios diferentes. La consulta de usuario de imágenes no cambia; las inserciones simultáneas colisionantes devolverán la violación UNIQUE en vez de crear dos filas. **No se ejecuta la migración en Education Marketplace en esta PR**.

El índice normal permite una transacción atómica pero bloquea escrituras sobre `listing_photos` mientras se construye. `CREATE INDEX CONCURRENTLY` no puede ejecutarse dentro de transacción y puede dejar índice inválido al fallar; por eso se deja una opción atómica con timeout y se exige autorización y preflight de tamaño/actividad actualizado antes de su ejecución.

## Prueba independiente y no productiva
Un nuevo paso en el workflow de PostgreSQL 17 local (`scripts/p0_listing_photos_unique_pg17.py`) crea una base desechable, introduce duplicados y exige rollback, elimina el duplicado, comprueba creación del índice y rechazo de una segunda URL del mismo anuncio, aceptación de la misma URL para otro anuncio, invariancia de RLS/grants y bloqueo de reejecución. Se elimina la base al finalizar. Sin credenciales de producción ni datos de familias.

## Dependencia y aprobación
Para aplicar el SQL a producción se requiere una autorización **específica y posterior**, con ventana de baja actividad, preflight de bloqueos y duplicados y comprobación posterior. Este PR no concede esa autorización. La corrección de UX de un posible error UNIQUE durante reparación se revisará antes del despliegue.

AMPA 0/3, DR integral pendiente y apertura general NO-GO. Respaldos previstos para 17/11 sin adelantar.
