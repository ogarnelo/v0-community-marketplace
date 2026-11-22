# WETUDY — START HERE: continuidad técnica y prioridades

## BLOQUE ACTIVO R3/A-015 — duplicidad de solicitudes de donación pendientes (22/11/2026)

**PR [#807](https://github.com/ogarnelo/v0-community-marketplace/pull/807)**: corrección completa propuesta para que un mismo solicitante no cree **dos solicitudes pending** simultáneas del mismo anuncio. El código `lib/services/donations.service.ts` ya comprobaba pending antes de insertar, pero no estaba protegido frente a dos peticiones concurrentes. En la lectura SQL de 22/11, `donation_requests` tenía 0 filas; el índice existente `donation_requests_one_approved_per_listing_idx` limita un **approved** por anuncio, **no** los pending por usuario. No reinterpretar el alcance de #591 ni repetir su ensayo.

Se prepara un índice único parcial `donation_requests_one_pending_per_requester_listing_idx` solo para `status='pending'`, con preflight y postflight, en `scripts/review_only/r3_donation_pending_unique_candidate.sql`. **NO es migración instalada ni está en el directorio automático de migraciones**; su ejecución en Supabase WETUDY exige autorización nueva, preflight read-only, plan de rollback y verificación de ACL/RLS. El servicio traduce exclusivamente `23505` de este índice a conflicto HTTP 409 mediante la clase ya existente. Dos transacciones concurrentes PG17 se prueban en base aislada y el test runtime valida que no se envíen efectos secundarios antes de confirmar el INSERT.

**Cierre A-015:** CI exacta y preview READY, merge, Vercel producción READY; **aplicación SQL explícitamente autorizada** en `Education Marketplace` y postflight de catálogo (index unique/valid/ready, RLS y grants intactos) para declarar corregida la concurrencia **en producción**. Sin ese último paso, solo `PREPARADO, INSTALACIÓN PENDIENTE`. No iniciar otro subbloque R3 hasta cerrar este, o bloqueo externo y repriorización expresa.

Mantener **donaciones entre colegios**; la clave es anuncio + solicitante, sin validación de colegio del solicitante. No hacer cambios al proyecto Supabase VM Copilot. R3 global sigue abierto con A-002, A-025/A-026 y otras decisiones separadas. #787 cerrado sin merge, privacidad pendiente en #804. **Piloto NO-GO**.

## CIERRE VERIFICADO R3 / A-019 — 22/11/2026

La [PR #806](https://github.com/ogarnelo/v0-community-marketplace/pull/806) **se fusionó** por squash en `main` commit `053a4645d21e18cfb24f848e2bc086028b620eb0` tras CI íntegra SUCCESS del HEAD `dfb5a28bc347bb7839ae4e036a328e34a18a42d8` (contratos con prueba runtime de ambas rutas, PG17 escolar y alertas, compilación Next.js/sitemap). El despliegue de producción Vercel `dpl_EQY7rub4SuiGf362cL94Xn8NE25C` fue confirmado **READY para ese SHA exacto**. **Subbloque A-019 CERRADO**, sin DDL/DML, permisos, flags, Auth, correos ni datos alterados. La PR solo impide falsos éxitos de cancelación/incidencia cuando una RPC devuelve un resultado ausente, ajeno o de estado incorrecto.

**No confundir con cierre R3 global**: adjudicación concurrente, donaciones y otros hallazgos A-002/A-015/A-025/A-026 siguen en backlog, con pruebas sintéticas y exigencia de cierre secuencial. La antigua sección «Bloque activo R3 — ...» de más abajo describe la fase previa a este cierre; este encabezado es el estado vigente. #787 archivada sin merge, deuda #804 abierta; piloto general NO-GO. No repetir A-019 si no hay regresión.

## Bloque activo R3 — acuerdo/cancelación/incidencia, hallazgo A-019 (22/11/2026)

La [PR #806](https://github.com/ogarnelo/v0-community-marketplace/pull/806) atiende exclusivamente A-019, previamente documentado: dos endpoints de acuerdos podían responder `ok:true` cuando `server_cancel_agreement` o `server_dispute_agreement` devolvía `null`/respuesta vacía. Se añaden comprobaciones de fila, ID y estado esperado, respuesta privada 503 de resultado no verificado, y pruebas runtime sintéticas de ambas rutas incluidas en CI. No hay evidencia de falsos éxitos reales productivos.

**Criterio de cierre A-019:** comprobar CI de HEAD exacto, fusionar sin solapamiento, verificar Vercel producción READY y anotar el cierre en #767 y maestro. **No atribuirle cierre a todo R3**: concurrencia de adjudicación/donaciones y otros hallazgos A-002/A-015/A-025/A-026 requieren sus propios criterios y no se han intervenido. No ejecutar SQL, activar flags, enviar correos ni abrir piloto por esta corrección. Mantener donaciones entre colegios permitidas.

## ESTADO VIGENTE — decisión expresa del propietario, 22/11/2026

**#787 CERRADA ADMINISTRATIVAMENTE SIN MERGE**, no cerrada como remediación ejecutada. El propietario autorizó explícitamente archivar la PR #787 sin integrar sus 98 commits y **repriorizar** para avanzar a otro bloque; la PR se ha comprobado `CLOSED`/`merged=false`. La propuesta de retirar cinco `anon SELECT` **NO SE HA APLICADO** y continúa **PENDIENTE DE SEGURIDAD**, rastreada en [issue #804](https://github.com/ogarnelo/v0-community-marketplace/issues/804). Esta excepción está permitida por la norma general de repriorización expresa; no convertirla en precedente automático.

- Seguimiento central: [#767](https://github.com/ogarnelo/v0-community-marketplace/issues/767). No reabrir #787 ni rehacer sus pruebas sin nueva evidencia/requisito.
- Volver a #804 solo tras inventario/atestaciones reales de consumidores (incluida vista `demand_opportunities_30d`), revisión de seguridad independiente, snapshot y rollback productivo aceptados y autorización **nueva y específica** para cualquier REVOKE.
- Proyectos Supabase identificados: WETUDY **Education Marketplace** `jpsljmakoscqevssimtk`; **VM Copilot** `iaoeqkjgjprnuzhbvkgc` independiente y fuera de alcance. WETUDY enlaza con Vercel `v0-community-marketplace`; integraciones instaladas Supabase y Resend. Webhooks Vercel no inventariables con el acceso actual (403). **No volver a pedir la identificación de estos proyectos.**
- **Piloto general NO-GO**; permisos de Supabase, RLS, datos, flags, migraciones y secretos sin modificar. El siguiente bloque debe determinarse por su puerta vigente, no por reabrir #787.

**Nota de lectura:** las secciones inferiores describen observaciones históricas previas al cierre administrativo; donde digan que #787 está DRAFT/abierto, prevalece el estado vigente indicado arriba.

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

## Inventario histórico de PR y puertas (antes del cierre de #787)

| PR | Estado, límite, siguiente puerta |
|---|---|
| [#787](https://github.com/ogarnelo/v0-community-marketplace/pull/787) | **CLOSED SIN MERGE** por decisión expresa del propietario el 22/11/2026. Ensayos y evidencia histórica conservados; revocación de cinco `anon SELECT` **no aplicada**, pendiente de seguridad en [#804](https://github.com/ogarnelo/v0-community-marketplace/issues/804). |
| [#232](https://github.com/ogarnelo/v0-community-marketplace/pull/232) | DRAFT, WhatsApp account linking, pospiloto. |
| [#231](https://github.com/ogarnelo/v0-community-marketplace/pull/231) | DRAFT, publicación asistida WETUDY Easy IA, pospiloto. |
| [#227](https://github.com/ogarnelo/v0-community-marketplace/pull/227) | DRAFT, aviso email tras signup verificado; requiere ensayo real de registro/mail e idempotencia antes de considerar merge. |

Otros bloques sin reabrir: reporting global R1 PR #789 migrada, cron apagado; federaciones FAMPA/CEAPA PR #788 fusionada y feature flag OFF; fotos Storage y edición retesteadas por usuario tras #750.

## Auditoría específica #787 — observación posterior al maestro V38

La comprobación de catálogo de **solo lectura** del 22/11/2026 confirma las cinco tablas con anon SELECT, RLS activo y cero políticas anon/PUBLIC. Se han identificado dos vistas invocadoras dependientes: `demand_opportunities_30d` sobre `demand_requests` (**anon SELECT en la vista = sí**, potencial ruptura de consumidor invitado), y `saved_search_demand_summary` sobre `saved_searches` (**anon SELECT en la vista = no**). No son riesgos idénticos. Ver evidencias y consulta reproducible en [P0_PRIVACY_787_READONLY_CONSUMER_DEPENDENCIES_20261122.md](P0_PRIVACY_787_READONLY_CONSUMER_DEPENDENCIES_20261122.md). Atestaciones externas siguen sin acreditarse; **no aplicar REVOKE** ni cerrar #787 por pruebas locales.

## Evidencia histórica #787 — bloqueo anterior a la repriorización

En el corte anterior al cierre administrativo, **la PR #787 estaba DRAFT** con ocho categorías de consumidores sin atestación firmada y ocho verificaciones externas en falso, conforme al manifiesto de su rama. El cierre técnico de ensayos PG17/SSR/PostgREST/Realtime locales **no habilita** `REVOKE` en producción ni el merge. Faltan responsables externos y revisor independiente para el inventario, ensayos de integraciones, rollback sobre ACL exactos y aprobación de propietario. Ver el acta de cierre pendiente: [P0_PRIVACY_787_CIERRE_PENDIENTE_20261122.md](P0_PRIVACY_787_CIERRE_PENDIENTE_20261122.md).

**Condición histórica resuelta por decisión expresa del propietario el 22/11/2026:** autorizado el archivo sin merge y la repriorización; el riesgo técnico sigue pendiente en #804. Evitar gastar más tiempo repitiendo pruebas ya aprobadas.

## #787 — Responsable identificado, firma aún pendiente (22/11/2026)

El propietario ha confirmado que **por ahora él mismo es responsable de inventariar las aplicaciones externas, móviles y automatizaciones**. Esto identifica el interlocutor pero **no constituye atestación firmada de que no existen otros consumidores**. Se ha preparado un inventario con hechos observados y una declaración de siete puntos que el propietario debe validar: [P0_PRIVACY_787_OWNER_CONSUMER_INVENTORY_20261122.md](P0_PRIVACY_787_OWNER_CONSUMER_INVENTORY_20261122.md). El revisor independiente de seguridad/rollback sigue sin identificarse. **#787 permanece ABIERTO/BLOQUEADO EXTERNAMENTE; no REVOKE ni otro frente sin decisión expresa.**

## Qué hacer ahora

- Priorizar una **acción nueva y verificable** sin duplicar R2: abordar la revisión externa de consumidores/rollback de #787 por vía documental; no retirar grants hasta atestación. Si dependencias necesitan consentimiento externo, registrar bloqueo y pasar al siguiente frente no bloqueado.
- Mantener el canary escolar y RPC baja estudiantes **OFF** hasta puerta funcional y autorización separada.
- No fusionar ramas enormes/draft sin limpiar alcance y verificar HEAD de CI, ni confiar en builds verdes de commits antiguos.
- Al finalizar cada tanda: verificar main, CI y Vercel `READY` del SHA resultante; registrar en [#767](https://github.com/ogarnelo/v0-community-marketplace/issues/767) y **crear la siguiente versión maestra** anexando hechos nuevos al archivo anterior, conservando el histórico íntegro. Actualizar este índice solo si cambian las prioridades o hechos de referencia.

## Evidencias históricas de tanda anterior (22/11/2026; no sustituyen verificaciones actuales)

GitHub main `b586e0a5069409fbff39795f169453a8585d4650`, Vercel `READY`; PR abiertas exactamente #787/#232/#231/#227. Ambas RPC R2 presentes; 11 usuarios Auth, 11 perfiles, 1 colegio, 2 roles, 1 school_admin, 0 diferencias rol/perfil. No se ejecutó DML ni DDL en este repaso. Los cambios introducidos en este PR son **solo documentación de continuidad**, sin flags ni migraciones.
