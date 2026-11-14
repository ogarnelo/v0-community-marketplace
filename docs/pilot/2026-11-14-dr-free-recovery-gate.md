# WETUDY · Recuperación DB + Auth + Storage sin Supabase Pro

**Estado 14/11/2026:** NO-GO integral. Sin segundo proyecto, staging ni modificaciones en producción.

## Evidencia ya existente (NO repetir descarga innecesariamente)
- Backups reales cifrados: DB/ACL workflow run 43105818628, artefacto 13894680992; Storage run 43152640909, artefacto 13913674235.
- Recuperación combinada parcial: workflow run 43153468952, SUCCESS; no prueba restauración completa de Auth/GoTrue, base y bytes Storage en instancia nueva.
- Fundador confirmó conservación privada de los dos ZIP cifrados y comprobación SHA256 local: PASS database y PASS storage. No almacenar ZIP, contraseñas o hashes vinculables a datos privados en issues.
- Ejercicios PostgreSQL17 y Supabase CLI con datos sintéticos y PR #459/#460 fortalecen controles; **no constituyen DR certificada**.

## Plan de aceptación de una recuperación real sin infraestructura de pago
| ID | Requisito | Evidencia necesaria | Estado |
|---|---|---|---|
| DR-01 | Integridad de ambos cifrados | SHA256 local PASS comunicada | PASS informado |
| DR-02 | Copias conservadas fuera de artefactos temporales | Custodia cifrada privada | Confirmado por fundador |
| DR-03 | DB restaurada incl. estructura, datos, grants, funciones y RLS | Recuento y test ACL/RLS sin exponer datos | PARCIAL local |
| DR-04 | Auth recuperable (usuarios, identidades, claves/configuración GoTrue y sesiones válidas según procedimiento) | Ensayo E2E autorizado y protocolo no dependiente de secretos exportados | PENDIENTE |
| DR-05 | Bytes Storage y políticas recuperados | Manifiesto 35 objetos, integridad y acceso desde cliente autorizado | PARCIAL |
| DR-06 | Coherencia temporal DB/Storage/Auth | Marca de ventana y manejo de cambios entre respaldos | PENDIENTE |
| DR-07 | RTO/RPO y plan de reversión medidos | Tiempos y pérdidas máximas aceptables firmadas | PENDIENTE |
| DR-08 | Prueba bajo restricciones Free y sin datos reales extraídos | Ensayo local aislado, autorizado, sin exportar secretos personales | PENDIENTE |

## Procedimiento seguro
1. Preservar respaldos cifrados offline y no transferirlos a asistentes, issues ni repos.
2. Utilizar primero datos totalmente sintéticos para montar y resetear stack local aislado (PostgreSQL17 + GoTrue + PostgREST + Storage CLI si disponible). Bloquear conexiones externas y correos de prueba.
3. Separar un ensayo de importación SQL/ACL de pruebas Auth y Storage: confirmar que cada capa requiere pasos distintos.
4. Para cualquier ensayo sobre datos reales, obtener aprobación explícita, entorno aislado y valoración legal previa; no improvisar en Supabase Free.
5. Verificar acceso del usuario correcto, rechazo de tercero, manifest SHA256 de bytes, búsqueda/fotos/chat y roles/grants recuperados.
6. Registrar duración, errores, consistencia y procedimiento de vuelta atrás. Si cualquier requisito falla, mantener NO-GO.

**Nota:** No asumir que `pg_dump` de DB restituye automáticamente configuración completa GoTrue o bytes de Storage. No anunciar RTO/RPO no medidos.
