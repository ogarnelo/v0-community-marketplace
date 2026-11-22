# WETUDY — Normas obligatorias para agentes y colaboradores

Este archivo es la **base operativa permanente** de WETUDY. Debe leerse antes de planificar, editar, revisar, fusionar o desplegar cualquier cambio, también al iniciar un chat nuevo. Su contenido no depende de la memoria de un chat.

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

## Bloque prioritario al 22/11/2026

**#787 P0 privacidad:** retirada de `anon SELECT` en cinco tablas. La PR histórica permanece DRAFT, **no autorizada para fusionar o ejecutar REVOKE** por falta de atestaciones de consumidores externos y revisión independiente del rollback. Documento específico de estado: `docs/pilot/P0_PRIVACY_787_READONLY_CONSUMER_DEPENDENCIES_20261122.md`. El bloqueo no se elimina con más CI local: necesita pruebas y firmas de terceros.

Los demás estados, hashes y prioridades evolucionan: consultar el índice de continuidad y verificar las fuentes vivas. Este archivo contiene **reglas permanentes**, no promesas de fondo ni automatizaciones futuras.
