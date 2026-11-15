# WETUDY — PR555 · Reintentos idempotentes de publicación ante commit incierto
Fecha 15/11/2026. **No se cambia el esquema, ni las políticas ni los datos productivos.**

## Hallazgo
En el formulario de publicación, cada clic generaba `crypto.randomUUID()` nuevo para el anuncio. Si PostgreSQL insertaba la fila, pero la respuesta HTTP se perdía, el navegador presentaba fallo y el siguiente clic podía crear un segundo anuncio. Además, `setLoading(true)` no impide dos manejadores simultáneos durante el retardo de renderizado.

## Solución
- Guardar un UUID estable en `pendingListingIdRef` para el ciclo de intentos, y usar un `submissionInFlightRef` síncrono para impedir doble envío. La referencia se libera en `finally` sin perder el UUID en fallos de conectividad.
- `lib/marketplace/confirm-owned-listing-insert.mjs`: tras un error o excepción del INSERT, **comprobar con el cliente autenticado del vendedor y su RLS** que el mismo UUID pertenece exactamente al mismo `seller_id`. No usar `service_role` para comprobar la existencia.
- Solo si se confirma la fila previamente creada, continuar en el editor de ese mismo anuncio con aviso de fotos pendientes, evitando duplicados. Si la consulta no confirma propiedad, el resultado sigue siendo incierto y se mantiene el UUID para reintentar de forma idempotente.
- Preservar el flujo anterior de INSERT confirmado -> INSERT de fotos -> alertas -> ficha. No elimina Storage si el resultado de un commit es ambiguo.

## Pruebas y límites
Diez contratos y pruebas de ejecución para insertar correctamente, reconciliar tras error o excepción HTTP, rechazar fila ajena, ID diferente, RLS fallida, fallo de red en búsqueda, ID vacío, anti-doble-clic y compilación TSX. Estas pruebas sintéticas no certifican sesiones familiares reales. Los paths nuevos de fotos subidos en reintentos pueden dejar residuos si un fallo de red impide confirmar el estado: ese problema requiere conciliación de Storage y no se declara resuelto. No es una transacción distribuida.

AMPA #245 0/3; DR integral pendiente; respaldos custodiados para 17/11. Apertura general NO-GO.
