# WETUDY PR520 — Fotos inválidas no deben destruir borradores
15/11/2026; QA exclusiva; #447.

## Hallazgo
El PUT de listing-draft pasaba fotos del usuario por cleanPhotos que eliminaba elementos inválidos, acortaba arrays >8 y descartaba rutas que no pertenecen al usuario. A continuación escribía silenciosamente la lista filtrada, pudiendo quitar referencias existentes. Este hallazgo es de código, NO una incidencia confirmada en producción.

## Corrección
Si photos está presente, se exige array, máximo ocho elementos, todas las entradas válidas para la cuenta y rutas no repetidas. En caso contrario responde HTTP 400 privado (Cache-Control: private, no-store) sin instanciar service role ni escribir. Si photos se omite, sigue permitido el flujo anterior. Los mensajes no incluyen datos internos. Pruebas de handlers reales con Supabase simulado. No E2E productivo.

## Límites de release
#447 requiere permisos productivos verificables y autorización de migración con rollback.
#455 backup PG/ACL cifrado artifact 13894680992 expira 18/11/2026 21:47:30Z, Storage artifact 13913674235 expira 19/11/2026 04:07:49Z. Guardar ambos privadamente antes del vencimiento, sin claves en GitHub/chat. Restauración Auth/DB/Storage y RTO/RPO siguen pendientes, sin Supabase Pro.
#245 0/3 AMPA aceptadas; pruebas E2E y revisión humana pendientes. Gate automático go:false siempre.
Objetivo 26/11 condicionado. Estado NO-GO.
