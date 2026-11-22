# WETUDY — START HERE: continuidad técnica y prioridades

> **OBLIGATORIO: leer `AGENTS.md` en la raíz antes de cualquier avance.** La norma de cerrar un bloque antes de abrir otro es una **regla permanente de WETUDY**, reiterada por el propietario en múltiples ocasiones: TERMINAR → VALIDAR → FUSIONAR → READY → DOCUMENTAR → CERRAR. No volver a tratarla como regla nueva, no abrir micro-PR duplicadas ni cambiar de frente por iniciativa propia. Si el bloque está bloqueado externamente, permanece ABIERTO y solo podrá repriorizarse por decisión expresa. Al finalizar cada tanda actualizar **el índice, #767 y el maestro completo**, conservando el histórico.


**Fecha de corte:** 22 noviembre 2026 (actualizar SHA y estado en cada cierre). **Documento breve de traspaso entre chats**. Para detalle probatorio e histórico integral, utilizar el maestro descargable **WETUDY_AUDITORIA_CONTINUIDAD_22NOV2026_V40.md** (o versión más reciente) generado en la conversación y el [issue #767](https://github.com/ogarnelo/v0-community-marketplace/issues/767). No copiar los cientos de KB del maestro al repositorio; este archivo es el índice verificable y compacto.

## Cómo reanudar sin repetir trabajo

En un chat nuevo decir: *«Continúa WETUDY desde `docs/pilot/WETUDY_START_HERE_CONTINUIDAD.md` en `ogarnelo/v0-community-marketplace` y el issue #767. Lee el estado actualizado, verifica main y despliegue, evita repetir las PR #790–#799 y avanza sobre el primer bloqueo real sin alterar producción sin autorización.»* Adjuntar la versión maestra más reciente si se requiere el histórico integral. Los estados son la última observación, no una garantía futura: comprobar SHA/flags antes de cualquier acción.

- Código: GitHub **ogarnelo/v0-community-marketplace**; base antes de este cambio documental: `b586e0a5069409fbff39795f169453a8585d4650` (PR #799).
- Producción web: [wetudy.com](https://www.wetudy.com). Vercel project `prj_CLCg95Wcc9ScRMEhzwHTShCi8Ev5`, team `team_eUWtljTIUV67Un3Cx2mMZpNp`; deployment de #799 `dpl_9Bztj6BrcSwLpqJLBuYCZwcR2fAF` **READY**.
- Supabase Education Marketplace: project `jpsljmakoscqevssimtk` (PostgreSQL 17.6 en últimas pruebas). No incluir credenciales ni secretos en notas.
- **Piloto general NO-GO.** Sin colegios reales ni AMPAs verificadas hasta piloto; usar datos sintéticos y ensayos aislados. Ensayos funcionales reales pendientes pueden hacerse durante piloto, **no bloquear con ellos todo lo demás**. Stripe y profesionales **pospiloto**. Reportes FAMPA/CEAPA solo agregados de colegios representados, nunca datos personales.
- **Autorización NO heredable:** los permisos anteriores cubrieron únicamente migraciones/ensayos concretos. No activar flags, borrar datos, revocar grants o abrir piloto por inferencia.

## R2 — cerrado en implementación SQL, sin activación web

1. Alta/baja estudiantes: PR #790 (concurrencia) y #791 (adaptador). RPC `public.r2_deactivate_student_and_promote_candidate(uuid,uuid)` instalada como migración `20261122115621_r2_account_student_atomic_deactivation_pr791`; `SECURITY INVOKER`, solo `service_role`; `WETUDY_R2_STUDENT_ATOMIC_DEACTIVATE_ENABLED` ausente/OFF. No repetir instalación. La atomicidad entre Supabase Auth y DB **no está resuelta**.
2. Cambio de tipo de cuenta: PR #792–#795 cerradas, fusionadas y desplegadas; protección frente a escrituras obsoletas, Auth antes/después y solicitud no-op coherente. No crear nuevas micro-PR por lo mismo sin fallo nuevo.
3. Permisos escolares: PR #796–#798 cerradas; RPC `public.r2_grant_school_admin_atomic_candidate(uuid,uuid)` instalada en migración `20261122132030_r2_school_admin_atomic_grant_pr798`; `SECURITY INVOKER`, solo `service_role`. Concesión+perfil transaccionales y escuela activa serializada con `FOR SHARE` **sin trigger nuevo ni grants nuevos**. PG17 aislado pasó concurrencia y rollback.
4. PR #799 cerrada: doble control de canary. Se requieren **ambos** `WETUDY_R2_SCHOOL_ADMIN_ATOMIC_GRANT_ENABLED=true` y UUID exacto en `WETUDY_R2_SCHOOL_ADMIN_ATOMIC_GRANT_CANARY_USER_IDS`. Ambos env vars ausentes/OFF en última auditoría. Runbook: `docs/pilot/r2_school_admin_atomic_canary_runbook_20261122.md`.
5. **Ensayo real SQL con sintéticos y ROLLBACK SUPERADO** en Supabase después de autorización expresa: usuario Auth efímero con dominio `example.invalid`, un colegio activo y otro inactivo, concesión/idempotencia/rechazos correctos. La transacción `ROLLBACK` eliminó todo lo ficticio. Recuentos restaurados: 11 Auth, 11 perfiles, 1 colegio, 2 roles, 0 roles-perfiles incoherentes. Evidencia: [issue #767, comentario 7080675158](https://github.com/ogarnelo/v0-community-marketplace/issues/767#issuecomment-7080675158).
6. **Solo pendiente funcional R2:** ensayo HTTP/Vercel completo de canary con usuario de pruebas aprovisionado y eliminado mediante **Auth Admin API**, y eventual activación limitada. No escribir usuarios Auth persistentes directamente por SQL. Si no está disponible el lifecycle seguro, mantener OFF y postergar el E2E al piloto. Instalación SQL y prueba SQL no son pendientes.

## PR abiertas y puertas reales

| PR | Estado, límite, siguiente puerta |
|---|---|
| [#787](https://github.com/ogarnelo/v0-community-marketplace/pull/787) | DRAFT, 98 commits/29 archivos; propuesta de retirar `anon SELECT` en cinco tablas: `agreements`, `demand_requests`, `profiles`, `saved_searches`, `schools`. **No fusionar/aplicar** hasta atestación externa firmada, pruebas de consumidores reales, revisión independiente, snapshot y aceptación de rollback. `demand_opportunities_30d` es vista invocadora dependiente. La PR solo contiene SQL local/ensayos, no migración productiva. Documento: `docs/pilot/ANON_FIVE_TABLE_CONSUMER_ATTESTATION_2026-11-20.json` **en la rama de #787**, no necesariamente en main. `anon` todavía tiene SELECT de tabla en `agreements`, `profiles` y `schools` al último preflight, aunque RLS protege filas. La PR identifica también grants heredados DML/MAINTAIN que requieren revisión separada; no confundir permisos de tabla con acceso efectivo de fila. |
| [#232](https://github.com/ogarnelo/v0-community-marketplace/pull/232) | DRAFT, WhatsApp account linking, pospiloto. |
| [#231](https://github.com/ogarnelo/v0-community-marketplace/pull/231) | DRAFT, publicación asistida WETUDY Easy IA, pospiloto. |
| [#227](https://github.com/ogarnelo/v0-community-marketplace/pull/227) | DRAFT, aviso email tras signup verificado; requiere ensayo real de registro/mail e idempotencia antes de considerar merge. |

Otros bloques sin reabrir: reporting global R1 PR #789 migrada, cron apagado; federaciones FAMPA/CEAPA PR #788 fusionada y feature flag OFF; fotos Storage y edición retesteadas por usuario tras #750.

## Auditoría específica #787 — observación posterior al maestro V38

La comprobación de catálogo de **solo lectura** del 22/11/2026 confirma las cinco tablas con anon SELECT, RLS activo y cero políticas anon/PUBLIC. Se han identificado dos vistas invocadoras dependientes: `demand_opportunities_30d` sobre `demand_requests` (**anon SELECT en la vista = sí**, potencial ruptura de consumidor invitado), y `saved_search_demand_summary` sobre `saved_searches` (**anon SELECT en la vista = no**). No son riesgos idénticos. Ver evidencias y consulta reproducible en [P0_PRIVACY_787_READONLY_CONSUMER_DEPENDENCIES_20261122.md](P0_PRIVACY_787_READONLY_CONSUMER_DEPENDENCIES_20261122.md). Atestaciones externas siguen sin acreditarse; **no aplicar REVOKE** ni cerrar #787 por pruebas locales.

## Puerta #787 — bloqueo real, no cierre simulado

La **PR #787 sigue DRAFT** con ocho categorías de consumidores sin atestación firmada y ocho verificaciones externas en falso, conforme al manifiesto de su rama. El cierre técnico de ensayos PG17/SSR/PostgREST/Realtime locales **no habilita** `REVOKE` en producción ni el merge. Faltan responsables externos y revisor independiente para el inventario, ensayos de integraciones, rollback sobre ACL exactos y aprobación de propietario. Ver el acta de cierre pendiente: [P0_PRIVACY_787_CIERRE_PENDIENTE_20261122.md](P0_PRIVACY_787_CIERRE_PENDIENTE_20261122.md).

**No iniciar #227 ni otra PR funcional mientras #787 siga ABIERTO**, a menos que el propietario decida explícitamente repriorizar por bloqueo externo. Evitar gastar más tiempo repitiendo pruebas ya aprobadas.

## #787 — Responsable identificado, firma aún pendiente (22/11/2026)

El propietario ha confirmado que **por ahora él mismo es responsable de inventariar las aplicaciones externas, móviles y automatizaciones**. Esto identifica el interlocutor pero **no constituye atestación firmada de que no existen otros consumidores**. Se ha preparado un inventario con hechos observados y una declaración de siete puntos que el propietario debe validar: [P0_PRIVACY_787_OWNER_CONSUMER_INVENTORY_20261122.md](P0_PRIVACY_787_OWNER_CONSUMER_INVENTORY_20261122.md). El revisor independiente de seguridad/rollback sigue sin identificarse. **#787 permanece ABIERTO/BLOQUEADO EXTERNAMENTE; no REVOKE ni otro frente sin decisión expresa.**

## Qué hacer ahora

- Priorizar una **acción nueva y verificable** sin duplicar R2: abordar la revisión externa de consumidores/rollback de #787 por vía documental; no retirar grants hasta atestación. Si dependencias necesitan consentimiento externo, registrar bloqueo y pasar al siguiente frente no bloqueado.
- Mantener el canary escolar y RPC baja estudiantes **OFF** hasta puerta funcional y autorización separada.
- No fusionar ramas enormes/draft sin limpiar alcance y verificar HEAD de CI, ni confiar en builds verdes de commits antiguos.
- Al finalizar cada tanda: verificar main, CI y Vercel `READY` del SHA resultante; registrar en [#767](https://github.com/ogarnelo/v0-community-marketplace/issues/767) y **crear la siguiente versión maestra** anexando hechos nuevos al archivo anterior, conservando el histórico íntegro. Actualizar este índice solo si cambian las prioridades o hechos de referencia.

## Evidencias históricas de tanda anterior (22/11/2026; no sustituyen verificaciones actuales)

GitHub main `b586e0a5069409fbff39795f169453a8585d4650`, Vercel `READY`; PR abiertas exactamente #787/#232/#231/#227. Ambas RPC R2 presentes; 11 usuarios Auth, 11 perfiles, 1 colegio, 2 roles, 1 school_admin, 0 diferencias rol/perfil. No se ejecutó DML ni DDL en este repaso. Los cambios introducidos en este PR son **solo documentación de continuidad**, sin flags ni migraciones.
