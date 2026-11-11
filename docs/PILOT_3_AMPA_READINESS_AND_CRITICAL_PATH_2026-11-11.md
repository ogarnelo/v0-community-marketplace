# WETUDY — Estado y criterios verificables para abrir piloto de 3 AMPA
**Auditoría:** 11/11/2026 · **Incidencia de alertas:** #375 abierta · **Última PR fusionada revisada:** #428 (`4a40d71f`); **CI post-merge:** #43049818753 SUCCESS. **Recuperación cifrada post-merge:** #43049818747 pendiente de resultado definitivo al redactar

## Resumen ejecutable

El código de marketplace está en producción: GitHub CI de `main` **SUCCESS**, Vercel **READY**. Se mantienen **6 anuncios DEMO** conforme al seguimiento previo (no recontados en esta auditoría). La auditoría read-only de Supabase del **11/11/2026** confirma **93 migraciones** aplicadas, **79 tablas** en `public`, **143 políticas RLS en total (140 en `public`)**, y **34.845 centros en el directorio, con 0 enlaces activos**. Los estados previos de outbox y banderas de alertas no se han vuelto a comprobar en esta lectura. **No son equivalentes a declarar el piloto listo.**

El backlog de SQL preparado y no ejecutado consta de **7 migraciones**: 5 para intenciones de alerta/conciliación/reintentos y 2 para reducir privilegios SQL (`TRUNCATE/REFERENCES/TRIGGER/MAINTAIN`) en 11 tablas. Una nueva consulta de solo lectura a los 11 objetos y los roles `anon`/`authenticated` verifica que los **88 de 88 permisos efectivos** `TRUNCATE/REFERENCES/TRIGGER/MAINTAIN` evaluados siguen presentes. **No se ha ejecutado ninguna migración.** Ninguna migración debe aplicarse en bloque ni activarse por el mero hecho de tener CI verde.

### Bloqueos para el piloto

| Orden | Criterio observable de salida | Estado auditado | Por qué importa |
|---|---|---|---|
| 1 | Nueva copia cifrada con evidencia ACL de 176 permisos y restauración parcial vinculada al artefacto exacto, sin PII | **PENDIENTE**: #412 preparó el workflow; PR #420–427 reforzaron sus validaciones. Archivo anterior todavía LEGACY sin ACL. Solo ejecución manual de workflow oficial producirá una copia nueva con 176 permisos | Evitar perder capacidad de rollback de concesiones |
| 2 | Procedimiento de recuperación integral/contingencia contrastado, incluidos roles y RLS, Auth/GoTrue y bytes físicos de Storage | **PENDIENTE**: TOC de 79 tablas y directorio restaurado no certifican DR | No arriesgar datos familiares durante DDL |
| 3 | Corrección escalonada de permisos SQL: primero 3 tablas, luego 8, midiendo los 176 grants antes/después, con regresión API/RLS de QA autorizada | **PREPARADO EN REPO, SIN APLICAR**: 88 grants no-RLS aún presentes | Reducir privilegios sin romper flujos |
| 4 | Instalar y verificar en Supabase las 5 migraciones de alerta, en orden, con checks de funciones/RPC, aislamiento y rollback | **PENDIENTE**: 93 migraciones en vivo | Hacer funcionar el nuevo worker protegido |
| 5 | E2E controlada con buzones QA autorizados: una sola entrega, 409/timeout, resultado ambiguo, ventana de deduplicación 24h frente a outbox de 48h y conciliación de recibos | **PENDIENTE**: pruebas de doble de proveedor no sustituyen la entrega real | Evitar correo duplicado a familias |
| 6 | Verificar permisos de AMPA, incorporación QR, moderación y búsquedas de proximidad; monitorizar costes reales, errores y alertas antes de habilitar colegios | **PARCIAL**: recorridos y ensayos sintéticos anteriores, no todas las pruebas reales cerradas | Abrir 3 AMPA con control de incidencias |

**Alcance adicional de DR:** la auditoría read-only del catálogo de Supabase identifica **79 tablas `public`, 27 `auth` y 10 `storage`**. El catálogo de Storage **no** implica que existan en ese backup los archivos binarios. No asumir equivalencia entre el manifiesto de tablas y restauración de servicios gestionados.

### Qué está terminando (con evidencia)

- PR #399: catálogo del backup con 158 entradas `TABLE`/`TABLE DATA` de las 79 tablas públicas; no prueba filas o restore integral.
- PR #400–402: restauraciones de datos **sintéticos** para búsqueda próxima, historial de coincidencias, ACL y RLS entre familias ficticias.
- PR #403–404: auditoría read-only de políticas reales y bloqueo de reglas permisivas adicionales.
- PR #405/#408: SQL de revocación en dos fases y regresiones PostgreSQL17 aisladas; **no ejecutado** contra producción.
- PR #409–410: fotografía de 176 privilegios y comparador fail-closed antes/después con cobertura completa.
- PR #411: testigo de metadatos que relaciona el ID real del backup con el ensayo de restauración parcial. Ejecución oficial y gate posterior exitosos.
- PR #412: preparación de **futuras** copias cifradas con fotografía ACL separada. Todavía no se ha generado ni ensayado una copia nueva de ese formato.

### Dependencias / trabajo del fundador

**Única acción técnica externa actualmente identificada:** ejecutar manualmente `Wetudy encrypted database backup` en rama `main` cuando proceda, desde GitHub Actions. Los permisos disponibles a este asistente permiten leer resultados pero no disparar `workflow_dispatch`. No introducir el token o la clave de cifrado en el chat. Antes de la ventana de migraciones hará falta autorización explícita del responsable sobre el plan de recuperación y los buzones QA que pueden recibir correo.

### Seguridad y costes

- **No** activar escuelas, crear usuarios ficticios en Auth real ni enviar emails fuera de QA autorizado.
- Conservar los seis DEMO y la interfaz de marketplace sin rediseño.
- Evitar ramas de Supabase de pago o PITR nuevos hasta verificar coste/plan. No se dispone aquí de un cargo real facturado: no presentar estimaciones como gasto.
- La copia cifrada anterior #13810495727 expira el **17/11/2026 a las 22:40 UTC**. Un respaldo disponible durante siete días no reemplaza una política de recuperación auditada.
- Los dos temas legales/RGPD expresamente aplazados por el fundador siguen **aplazados**, sin considerarlos resueltos o bloqueos técnicos inventados.

### Evaluación de progreso

**Implementación técnica preventiva: avanzada. Habilitación operativa segura del piloto: no terminada.** No se asigna un porcentaje ni una fecha ficticios: el progreso se declarará cuando se cierren en orden los seis criterios, con enlaces de CI, verificación del DDL y pruebas QA. Si se necesita priorizar un piloto privado **sin avisos por email**, separar explícitamente este alcance y auditar sus permisos/funciones por sí solo, sin declarar resuelto #375.

> Este documento es un registro de decisión de preparación, no una autorización para migrar, activar escuelas o ejecutar recuperaciones con datos personales.

## Actualización verificable — 11/11/2026, tras PR #428

**Consultas directas ejecutadas contra el proyecto Education Marketplace:** solo `SELECT` de catálogos y agregados; no se han leído cuentas, mensajes ni datos personales, ni se ha escrito SQL.

- `supabase_migrations`: **93** versiones aplicadas (última observada `20261110194657 marketplace_school_link_invalidation_v2`).
- `pg_policies`: **143** en total, **140** en esquema `public`. Las pruebas de restauración real siguen cubriendo solo **2**; el número 143 no significa 143 funcionalmente certificadas.
- `pg_tables`: **79** tablas en esquema `public`.
- `school_directory`: **34.845** entradas, con **0** enlaces/SEO activos; no se han creado colegios reales.
- `has_table_privilege`: **88 de 88** combinaciones de privilegios peligrosos presentes entre 11 tablas, 2 roles y 4 permisos; ello **no significa** 88 exposiciones iguales en criticidad, sino 88 resultados booleanos efectivos que deben retirarse con regresión y rollback.

**Control de daños y dependencia:** mantener sin ejecutar las **7 migraciones pendientes** (2 ACL, 5 alertas); ninguna prueba parcial de recuperación o CI verde sustituye una recuperación integral y autorización de cambio. Mantener cron y alertas sin habilitar.

### Procedimiento de la siguiente copia cifrada con ACL (sin secretos en el chat)

1. En GitHub Actions, seleccionar **Wetudy encrypted database backup**, rama `main`, y usar **Run workflow** solo con autorización operativa. El workflow usa secretos GitHub ya configurados `WETUDY_BACKUP_DATABASE_URL` y `WETUDY_BACKUP_ENCRYPTION_PASSWORD`. Nunca copiar credenciales a tickets o chats.
2. Confirmar que el run termina `success`, con artifact nuevo `wetudy-encrypted-postgres-backup`. Verificar que contiene `wetudy.dump.enc`, `wetudy-acl-snapshot.json.enc` y `SHA256SUMS.txt`, con retención siete días. El script captura **176 entradas ACL**, las valida y cifra antes de subir archivos. No declarar que existe un backup nuevo hasta ver su artifact e identificador.
3. Ejecutar el workflow **Wetudy combined encrypted backup recovery check** sobre ese artifact (la ejecución manual sigue siendo necesaria si no hay otro trigger correspondiente). Confirmar que reporta hash válido, sobre ACL descifrado y validado, prueba RLS real aislada y directorio restaurado sin enlaces; correlacionar `wetudy-partial-restore-proof-db-<ID>` y `wetudy-acl-verified-proof-db-<ID>` con el **mismo** backup ID y run exitoso.
4. Verificar la salida del gate de metadatos `acl_snapshot_verified:true` y `full_disaster_recovery_certified:false`; `production_sql_migration_authorized:false` continuará siendo explícito. Si falta algún testigo, el workflow falla o el backup caduca, **no** aplicar cambios.
5. Documentar restauración/rollback integral de grants, roles, Auth/GoTrue y bytes Storage; planificar ventana de cambio y pruebas QA autorizadas antes de alterar los 88 privilegios. No activar notificaciones ni colegios por obtener solo la copia ACL.

**Limitación de la prueba previa:** se ha verificado con éxito la recuperación parcial de PR #425 (ejecución #43046921066), con ZIP seguro, dos políticas RLS reales y directorio de 34.845 escuelas. El backup legado carece de ACL. La recuperación post-PR #427 **también terminó SUCCESS**, run #43049068967: extracción ZIP, SHA-256 estricto, dos políticas RLS reales y 34.845 centros sin vínculos; el log evidencia todavía `LEGACY ARCHIVE: ACL evidence unavailable`. La recuperación posterior a #428 (#43049818747) permanece pendiente y no debe anticiparse como PASS.
