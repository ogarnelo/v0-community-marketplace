# PR517 — Orden seguro de guardado de borradores (QA)
Fecha: 2026-11-15. Bloque #447. Sólo rama de integración QA.

## Hallazgo
Antes de PR517, PUT listing-draft eliminaba fotos antiguas del bucket **antes** de confirmar el upsert del borrador. Ante fallo de base de datos, el borrador podía seguir haciendo referencia a fotos que ya habían sido borradas. Es un defecto de consistencia encontrado revisando el handler; no prueba explotación.

## Corrección
Mover limpieza Storage detrás del resultado confirmado de upsert. En fallo DB => HTTP 500 y cero llamadas de eliminación de fotos. En éxito => persistir borrador y sólo después eliminar rutas abandonadas y propias. Mantener mensajes genéricos sin detalles internos; conservar Cache-Control: private, no-store. Pruebas de orden y del fallo con mocks de Supabase, sin red real.

## Límites y aprobación
La operación DB+Storage sigue sin ser una transacción distribuida: si Storage falla tras upsert, puede haber un objeto huérfano; queda pendiente estrategia de reconciliación segura. No publicar en producción sin validación y autorización. #447 sigue NO-GO.
