# WETUDY — PR566 · El fallo de limpieza Storage no anula un borrador ya guardado
15/11/2026. Sin DDL, RLS, cambios de permisos ni operaciones sobre fotos reales.

## Problema
PR544, PR559 y PR561 establecen que primero se confirma el estado de `listing_drafts` y después se intenta eliminar Storage solo si no hay referencias en `listings.photos` o `listing_photos`. Sin embargo, un error HTTP devuelto por `Storage.remove()` en PUT no indicaba `cleanupPending`, y una excepción de red al invocar `remove()` se propagaba **después** del commit de la base de datos. Eso podía hacer creer al vendedor que su borrador no se había guardado o descartado, provocando reintentos engañosos.

## Solución
Tras confirmar upsert/delete, capturar tanto el objeto `error` como la excepción de `remove()`; registrar únicamente un token fijo, preservar la operación SQL ya confirmada y responder HTTP 200 privado con `cleanupPending:true` cuando queda una limpieza pendiente. No se intenta repetir borrados en caliente ni se abandona la comprobación de referencias publicada por PR559/561.

## Pruebas
Tres escenarios añadidos a la suite runtime existente del handler real: `PUT` cuando `remove` devuelve un error, `PUT` cuando lanza una excepción y `DELETE` cuando lanza una excepción. Las pruebas anteriores verifican que ante error SQL los archivos permanecen, que se preservan fotos publicadas y que errores de consulta no provocan eliminación.

Esta mejora no ejecuta una limpieza automática posterior de residuos; requeriría un proceso controlado y autorizado. No resuelve carreras entre Storage y PostgreSQL. La apertura sigue NO-GO: AMPA 0/3, E2E real y DR integral pendientes. Respaldos previstos por responsable para el 17/11.
