# WETUDY — Protocolo de validación del recuperador de avisos (antes de activarlo)

Fecha: 2026-11-10. Estado: **pendiente de ejecución E2E autorizada**.

Este documento es un plan de verificación, **no una autorización de activación**. La variable `WETUDY_ALERT_OUTBOX_ENABLED` debe continuar ausente o distinta de `true`; no se añade cron. No usar datos de menores ni activar comunidades reales para ensayar.

## Precondiciones y separación de entornos

- Entorno aislado o QA expresamente autorizado, dos cuentas adultas de prueba controladas y centros sintéticos, sin tocar los seis anuncios DEMO ni vincular los tres centros del piloto.
- Comprobar límites de la base de datos, revocación de anon/authenticated en RPC internas y existencia del `CRON_SECRET` únicamente en servidor. **Nunca escribir secretos, direcciones o CP en logs, tickets o capturas**.
- Para E2E con entrega real: usar solamente buzones QA permitidos y comprobar la configuración de seguridad, supresión e idempotencia del proveedor antes de ejecutar. El primer recorrido deberá hacerse con correo simulado o interceptado.
- Registrar commit, entorno, fecha, resultado y evidencia mínima sin PII. Ninguna prueba debe operar en producción sin autorización específica.

## Matriz E2E exigida (P0)

| Caso | Preparación QA | Resultado esperado |
| --- | --- | --- |
| A1 Coincidencia positiva | Búsqueda activada, artículo del mismo centro y dentro del radio aproximado | Una notificación interna y, si procede, un correo, nunca duplicados |
| A2 Escuela distinta | Búsqueda «mi comunidad» en centro A y anuncio centro B | Ningún aviso ni correo |
| A3 Cambio de vínculo | Descubrir coincidencia; antes de entregar, desvincular/revincular colegio QA | Invalida coincidencia pendiente con `school_link_changed`; no envía |
| A4 Cambio de código postal | Descubrir estando dentro; cambiar CP QA fuera de radio antes de enviar | Invalida con `radius_changed`; no envía |
| A5 Ubicación desconocida | Retirar CP QA antes de entrega con búsqueda de radio | Fallo cerrado: no envía |
| A6 Sin radio | Búsqueda global sin radio, mover CP del perfil | No se invalida solo por distancia |
| A7 Opt-out/edición | Pausar, cambiar filtros o eliminar búsqueda tras publicar | No reenvía aviso antiguo aunque se reactive |
| A8 Reinicio | Interrumpir descubrimiento entre upsert y checkpoint, luego repetir página | Retoma sin omitir ni duplicar coincidencias |
| A9 Reinicio de entrega | Interrumpir después de envío simulado y antes del marcado local | Revisar idempotencia de notificación y proveedor; registrar anomalías |
| A10 Gran audiencia | 3.003 búsquedas sintéticas y lotes de 12 + centinela | Se recorren todas; sin truncamiento en 1.000/180 ni saltos |
| A11 Supresión/sin email | Destinatario suprimido o sin dirección | Salto terminal etiquetado, nunca registrado como correo enviado |
| A12 Caducidad/lease | Token vencido, trabajo reclamado por otra ejecución y >48 h | El trabajador obsoleto no avanza ni entrega |

En cada escenario verificar por separado **notificación interna** y **email**. La ausencia de duplicados en pruebas unitarias no sustituye el ensayo entre la BD y el proveedor externo.

## Carrera residual entre validación y envío (P0)

Los chequeos escolares y postales se hacen antes de invocar los canales, pero los vínculos, CP y preferencias podrían cambiar durante la ventana de entrega. Una transacción de PostgreSQL no puede asegurar atomicidad con el proveedor externo de correo. Antes de activar: medir la ventana bajo QA, documentar si puede producir una entrega obsoleta y acordar el riesgo aceptable. No afirmar garantía de «exactamente una vez» sin evidencia.

## Telemetría y coste (P1)

Registrar para cargas sintéticas de 12, 200, 1.000 y 3.003 búsquedas: invocaciones, duración p50/p95, lecturas/escrituras PostgREST, bytes, estado de cola, reintentos, skips, emails aceptados, y consumo observado en Supabase/Vercel/proveedor. Separar **coste incremental medido** de estimaciones o precios de plan; no atribuir cargos actuales a pruebas sintéticas sin factura.

## Criterio de salida / bloqueo

La activación se mantiene bloqueada si falla cualquiera de A1–A9 o A12, si hay fuga de PII, un destinatario fuera de colegio/radio, duplicados no explicados, o falta evidencia E2E. A10–A11 y medición p95/costes se revisan antes de ampliar tráfico. Tras aprobación expresa, plantear habilitación escalonada en entorno QA; producción requiere una decisión independiente, plan de reversión y supervisión de cola.

## Referencias de implementación

- PR #369: checkpoints de 200 y dos fases.
- PR #370: consentimiento, revisiones de búsqueda y opt-out.
- PR #371: distancia actual del destinatario.
- PR #372: vínculos escolares actuales.
- `docs/PILOT_MARKETPLACE_ALERT_OUTBOX_GATED.md`: configuración y límites.
- Seguimiento: https://github.com/ogarnelo/v0-community-marketplace/issues/344.
