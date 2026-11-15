# WETUDY — PR #518: orden seguro de eliminación de borradores

Fecha: 15/11/2026. Ámbito: rama QA integration/pilot-anon-privacy-20261114, SIN producción, main ni DDL Supabase.

## 1. #447 Privacidad y consistencia

Hallazgo auditado: DELETE borraba primero fotos de Storage y después intentaba eliminar fila listing_drafts. Si la eliminación DB fallaba, el borrador persistía con fotos ya eliminadas. Corrección: efectuar DELETE de fila primero, abortar con 500 y no tocar Storage si hay error DB. En éxito, sólo después eliminar objetos del prefijo propio, respetando preservePhotoPaths. Si falla el cleanup posterior, registrar exclusivamente código fijo, responder éxito de eliminación DB sin exponer texto del backend. El cleanup puede dejar huérfanos; NO hay transacción distribuida, por lo que sigue pendiente reconciliación autorizada.

Añadir pruebas sobre handlers reales y dependencias simuladas: fallo DB no elimina fotos, éxito conserva rutas preservadas y no toca ajenas, error Storage minimizado. CI sintética no significa HTTP desplegado ni permisos productivos.

## 2. #455 Recuperación

No invalidar evidencias históricas: copias cifradas PG/ACL artefacto 13894680992 (caduca 18/11/2026 21:47:30 UTC) y Storage 13913674235 (caduca 19/11/2026 04:07:49 UTC); recuperación conjunta PARCIAL run 43153468952. Prioridad de intervención humana: descargar ambos artefactos cifrados y conservarlos en un lugar privado, sin claves en chat/issues. Sigue sin certificarse Auth/GoTrue + DB/ACL + Storage + RTO/RPO integrales. No usar producción como laboratorio; no se requiere Supabase Pro.

## 3. #245 Piloto AMPA

Continúan 0/3 aceptaciones reales. La puerta de salida exige autorización humana, E2E de dos familias ficticias autorizadas, verificación de CP/radio, chat, notificación, escuela y cleanup. No sustituir actas ni privacidad real con JSON sintéticos.

## Decisión

NO-GO al 15/11/2026; 26/11/2026 es fecha objetivo condicionada. Requiere aprobación expresa para toda migración o despliegue productivo.
