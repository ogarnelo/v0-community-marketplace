# WETUDY — Normas obligatorias para agentes y colaboradores

Este archivo es la **base operativa permanente** de WETUDY. Debe leerse antes de planificar, editar, revisar, fusionar o desplegar cualquier cambio, también al iniciar un chat nuevo. Su contenido no depende de la memoria de un chat.

## PRIORIDAD VINCULANTE — ECONOMÍA DE BUILDS (22/11/2026)

El propietario ha recibido cargos adicionales de **Build CPU Minutes** en Vercel tras numerosas iteraciones; la protección de su presupuesto es una condición de cierre de cada bloque. Referencia permanente: [norma de costes #767](https://github.com/ogarnelo/v0-community-marketplace/issues/767).

1. **Un bloque funcional a la vez, y una sola PR con un solo commit multifichero por candidato siempre que sea posible.** Preparar archivos y pruebas offline antes del primer push. No publicar una cadena de `update_file` que inicie una compilación por archivo, ni construir de nuevo tras una auditoría repetida.
2. **Objetivo máximo operativo: una preview READY y un build productivo por bloque**, salvo fallo demostrado y corregido fuera de Vercel; analizar primero el log de cualquier fallo antes de otro intento. No hacer redeploy manual ni `forceNew` sin justificación registrada.
3. **NO hacer commits de documentación exclusivamente para actualizar continuidad**. El issue #767 y el maestro acumulativo son la vía inmediata sin builds; incorporar `AGENTS.md` y `START_HERE` con la próxima PR funcional o de mantenimiento imprescindible.
4. El filtro real `vercel.json` → `scripts/vercel-ignore-qa-only.cjs` preserva los QA-only históricos, **omite previews sin PR** y puede omitir solo cambios de Markdown seguros si se conoce el último SHA desplegado. **PR con cambios funcionales y producción siempre compilan**. Si el historial Git/variables no permite comprobarlo, el filtro falla abierto y compila. Verificación: `node scripts/vercel-ignore-qa-only.cjs --self-test`.
5. Registrar explícitamente builds CANCELED/ERROR/READY y el SHA verificado. No alterar por defecto el tamaño de máquina, presupuestos, límites de gasto ni pausar producción. Cualquier ajuste adicional requiere autorización específica.

## ESTADO VIGENTE — decisión expresa del propietario, 22/11/2026

**#787 CERRADA ADMINISTRATIVAMENTE SIN MERGE**, no cerrada como remediación ejecutada. El propietario autorizó explícitamente archivar la PR #787 sin integrar sus 98 commits y **repriorizar** para avanzar a otro bloque; la PR se ha comprobado `CLOSED`/`merged=false`. La propuesta de retirar cinco `anon SELECT` **NO SE HA APLICADO** y continúa **PENDIENTE DE SEGURIDAD**, rastreada en [issue #804](https://github.com/ogarnelo/v0-community-marketplace/issues/804). Esta excepción está permitida por la norma general de repriorización expresa; no convertirla en precedente automático.

- Seguimiento central: [#767](https://github.com/ogarnelo/v0-community-marketplace/issues/767). No reabrir #787 ni rehacer sus pruebas sin nueva evidencia/requisito.
- Volver a #804 solo tras inventario/atestaciones reales de consumidores (incluida vista `demand_opportunities_30d`), revisión de seguridad independiente, snapshot y rollback productivo aceptados y autorización **nueva y específica** para cualquier REVOKE.
- Proyectos Supabase identificados: WETUDY **Education Marketplace** `jpsljmakoscqevssimtk`; **VM Copilot** `iaoeqkjgjprnuzhbvkgc` independiente y fuera de alcance. WETUDY enlaza con Vercel `v0-community-marketplace`; integraciones instaladas Supabase y Resend. Webhooks Vercel no inventariables con el acceso actual (403). **No volver a pedir la identificación de estos proyectos.**
- **Piloto general NO-GO**; permisos de Supabase, RLS, datos, flags, migraciones y secretos sin modificar. El siguiente bloque debe determinarse por su puerta vigente, no por reabrir #787.

## Principio vinculante: cerrar bloques antes de avanzar

**Trabajar un bloque funcional a la vez. TERMINAR → VALIDAR → FUSIONAR → VERIFICAR DESPLIEGUE → DOCUMENTAR → CERRAR. DESPUÉS, y solo después, abrir otro bloque.**

1. Antes de actuar, leer `docs/pilot/WETUDY_START_HERE_CONTINUIDAD.md`, consultar el [issue maestro #767](https://github.com/ogarnelo/v0-community-marketplace/issues/767), identificar las PR/ramas existentes y comprobar el SHA real de `main` y el despliegue Vercel. No repetir inspecciones ya concluidas salvo nuevo indicio verificable.
2. Definir explícitamente qué significa **cerrar** el bloque: resultados funcionales, tests (incluidos fallos y concurrencia pertinentes), CI del commit exacto, revisión y fusión si procede, Vercel producción `READY` cuando hay código desplegable, migración SQL confirmada si autorizada, postflight sin regresiones, registro en #767 y actualización del maestro de continuidad.
3. **No abrir trabajos de otros bloques mientras uno permanezca en ejecución.** Evitar micro-PR, ramas paralelas redundantes, auditorías circulares y documentación que aparente cerrar un bloque sin resolver su condición crítica. Agrupar cambios coherentes en una misma PR cuando sea posible.
4. Si depende de permisos, firmas, consumidores externos, un E2E real o del futuro piloto, registrar exactamente las evidencias, el responsable externo, la autorización necesaria y la condición de reanudación. Clasificar como **BLOQUEADO EXTERNAMENTE / ABIERTO**, nunca como `CERRADO`. No continuar con implementación ciega ni declarar terminación; pedir solo la intervención externa indispensable cuando llegue a ser el único avance posible.
5. Solo se permite avanzar a otro bloque tras cerrar el actual, **o** tras documentar un bloqueo externo no resoluble autónomamente y recibir una decisión explícita de repriorización del responsable del proyecto. No reinterpretar un “go” genérico como autorización para saltarse esta norma.
6. Los bloques cerrados **no se reabren** por comodidad: exigen una regresión, hallazgo nuevo con impacto concreto, requerimiento nuevo o autorización explícita. Se revisan primero ramas y PR anteriores para prevenir solapamiento.
7. Las autorizaciones de SQL, RLS, `GRANT/REVOKE`, variables Vercel, datos, envíos reales, Stripe o apertura del piloto son **específicas**. No inferir nuevas autorizaciones de permisos concedidos para otro cambio.
8. Al terminar cada tanda, dejar **reanudación autosuficiente**: actualizar `docs/pilot/WETUDY_START_HERE_CONTINUIDAD.md`, el issue #767 y el documento maestro V siguiente **conservando íntegro el histórico**. Incluir SHA/PR/CI/READY/SQL/flags, bloque activo y siguiente puerta, distinguiendo hechos verificados de pendientes.

## Clasificación de estado

- **EN CURSO:** cambios/pruebas de un único bloque activo, con objetivo de cierre explícito.
- **BLOQUEADO EXTERNAMENTE / ABIERTO:** falta una decisión, firma, proveedor o ensayo autorizado y no puede concluirse autónomamente; debe conservarse como bloque activo salvo repriorización expresa.
- **ARCHIVADO ADMINISTRATIVAMENTE CON REMEDIACIÓN ABIERTA:** existe una decisión expresa y trazable del propietario de cerrar la PR sin merge y continuar otro bloque; la deficiencia técnica sigue abierta en un issue independiente y no se declara solucionada.
- **CERRADO TÉCNICAMENTE, ACTIVACIÓN PENDIENTE:** código/CI/RPC y despliegue preparados, pero flag, smoke, SQL o piloto siguen sujetos a puerta independiente. No equivaler a cierre funcional.
- **CERRADO DEFINITIVAMENTE:** requisitos del alcance y postflight verificados; no repetir sin nueva evidencia.
- **POSPILOTO:** no activar ni intercalar con el bloque activo.

## Restricciones estables del proyecto

- **Piloto general NO-GO** hasta autorización expresa.
- **No hay colegios reales ni AMPAs verificadas hasta piloto.** Pruebas únicamente con datos sintéticos y limpieza verificada; los ensayos humanos pueden diferirse al piloto cuando se decida.
- **Stripe, profesionales, WhatsApp y publicación IA** quedan fuera del piloto inicial salvo nueva decisión expresa.
- **FAMPA/CEAPA:** reportes únicamente agregados de AMPAs representadas, filtrados por colegio y minimización/supresión de cohortes pequeñas; no acceso a PII de usuarios.
- No afirmar éxito de producción, merge, pruebas o despliegues que no hayan sido comprobados.
- Si la capacidad o herramientas no permiten el cierre, explicitar el límite y no fabricar evidencias.

## Seguimiento del bloque #787 (estado vigente)

La PR #787 fue **cerrada administrativamente SIN MERGE** por decisión explícita del propietario; la propuesta de revocación de `anon SELECT` en cinco tablas **sigue pendiente** en [#804](https://github.com/ogarnelo/v0-community-marketplace/issues/804). No hay autorización para ejecutar SQL productivo; revisión independiente, atestación y rollback siguen por acreditar. La norma permanente de secuencialidad se mantiene: esta salida fue una repriorización explícita, no un cierre funcional ni una licencia para saltar automáticamente otros bloqueos.

Los demás estados, hashes y prioridades evolucionan: consultar el índice de continuidad, #767 y verificar las fuentes vivas. Este archivo contiene **reglas permanentes**, no promesas de trabajo de fondo ni automatizaciones futuras.
