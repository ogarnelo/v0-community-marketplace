# WETUDY — PR519: lectura fallida de fotos de borrador bloquea escrituras
Fecha 15/11/2026. QA exclusiva. NO producción / NO main.

## #447 — Hallazgo real en handler
Hasta esta PR, los métodos PUT y DELETE de `app/api/marketplace/listing-draft/route.ts` consultaban `photos` y desestructuraban solo `data`. Si Supabase devolvía error, se asumía lista vacía y se podía continuar con upsert/delete. Consecuencia posible: objetos Storage huérfanos y estado inconsistente sin advertencia. No hay evidencia de explotación o incidencia productiva.

## Cambio controlado
En ambos caminos, desestructurar `error: existingError` y devolver HTTP 500 genérico `No se pudo cargar el borrador.` si la lectura falla, **antes** de guardar o borrar. Mantener `Cache-Control: private, no-store`, separación por `user_id` y el orden DB->Storage de las PR517-518. No registrar errores privilegiados.

## Cobertura
Tests Node usando el handler real transpileModule y dependencias Supabase simuladas. Prueban que PUT y DELETE no llaman `db_upsert`, `db_delete` ni `storage_remove` ante fallo de lectura, que no se filtra `READ_PRIVATE_DO_NOT_LEAK`, y que el gate 500 sigue privado. La CI de QA no acredita despliegue productivo.

## Otros P0
#455: conservar artefactos cifrados PG/ACL (13894680992, caduca 18/11/2026 21:47:30 UTC) y Storage (13913674235, caduca 19/11/2026 04:07:49 UTC) antes del vencimiento. Restauración integral Auth/DB/Storage, RTO/RPO y autorización pendientes; Supabase Free, sin segundo proyecto.
#245: 0/3 AMPA certificadas, faltan actas y E2E con familias de prueba autorizadas. `go:false` incluso con declaraciones booleanas completas.
Estado global NO-GO hasta pruebas reales y aprobación humana.