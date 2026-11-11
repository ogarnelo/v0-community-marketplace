# WETUDY — Estado y criterios verificables para abrir piloto de 3 AMPA
**Auditoría:** 11/11/2026 · **Incidencia de alertas:** #375 abierta · **Última PR verificada:** #412 (`707e45c3`)

## Resumen ejecutable

El código de marketplace está en producción: GitHub CI de `main` **SUCCESS**, Vercel **READY**. Se mantienen **6 anuncios DEMO**, **0 trabajos** en outbox, **93 migraciones** aplicadas y ambas banderas de alertas ausentes. **No son equivalentes a declarar el piloto listo.**

El backlog de SQL preparado y no ejecutado consta de **7 migraciones**: 5 para intenciones de alerta/conciliación/reintentos y 2 para reducir privilegios SQL (`TRUNCATE/REFERENCES/TRIGGER/MAINTAIN`) en 11 tablas. La exposición de privilegios sigue presente en el sistema real. Ninguna migración debe aplicarse en bloque ni activarse por el mero hecho de tener CI verde.

### Bloqueos para el piloto

| Orden | Criterio observable de salida | Estado auditado | Por qué importa |
|---|---|---|---|
| 1 | Nueva copia cifrada con evidencia ACL de 176 permisos y restauración parcial vinculada al artefacto exacto, sin PII | **PENDIENTE**: #412 solo ha preparado el workflow, backup anterior aún es LEGACY | Evitar perder capacidad de rollback de concesiones |
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
