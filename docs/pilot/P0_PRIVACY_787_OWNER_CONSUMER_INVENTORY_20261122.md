# WETUDY #787 — Inventario de consumidores: responsable identificado, declaración pendiente

**22/11/2026. Estado: BLOQUEADO EXTERNAMENTE / ABIERTO.** Este archivo se añade al bloque #787, no abre otro frente. No es una atestación firmada, una autorización de revocación, un informe de seguridad independiente ni una confirmación de inexistencia de integraciones.

## Responsable principal

El propietario del proyecto ha declarado en conversación el 22/11/2026: **«por el momento soy yo»**, en respuesta a quién podía confirmar qué aplicaciones externas, móviles o automatizaciones utilizan Supabase. Queda identificado **el responsable de recabar y validar el inventario de WETUDY** como *propietario actual del proyecto*. Identidad nominal, inventario definitivo, evidencia firmada y revisor independiente: **no acreditados**. No establecer `owner_signed_*` como `true` ni rellenar `responsible_owner_signoff_at_utc` por esta sola declaración.

## Evidencia técnica reproducible vs. declaración que falta

| Clase de cliente | Evidencia observada o declarada en repositorio | ¿Se puede descartar dependencia invitada externa? | Estado de firma |
|---|---|---|---|
| Navegador y SSR web | `lib/supabase/client.ts`, `lib/supabase/server.ts`; clientes autenticados y rutas públicas | No; la búsqueda de código no inventaría versiones desplegadas ajenas | Pendiente |
| Rutas privilegiadas Next.js | `lib/supabase/admin.ts` y APIs internas | No; confirmar además todos los consumidores y el ciclo de vida de claves | Pendiente |
| Cron Vercel | `vercel.json` declara `school-impact-reports` 06:00 UTC, `super-admin-reports` 06:30 UTC y `email-health` 07:00 UTC cada día | No: declaración de configuración no prueba ejecución ni ausencia de otros jobs | Pendiente |
| Supabase Edge Functions | API de Supabase: **0 funciones actualmente listadas** | No: no descarta clientes históricos, integraciones directas ni otros proyectos | Pendiente |
| Realtime de acuerdos | `agreement-panel.tsx` escucha cambios; QA WebSocket aislado cubierto por #787 | No: requiere inventario de aplicaciones/suscripciones remotas | Pendiente |
| Scripts, importaciones y automatizaciones offline | Herramientas CLI en repositorio; uso efectivo no demostrado | No: requiere confirmación del responsable | Pendiente |
| Vistas/Data API/RPC externas | `demand_opportunities_30d` es `security_invoker` y tiene `anon SELECT`; depende de `demand_requests`. `saved_search_demand_summary` no tiene anon SELECT en la vista | No; requiere identificación de consumos de invitados y rollback | Pendiente |
| Aplicaciones móviles, integraciones de terceros, builds antiguos | No identificadas a partir del catálogo GitHub y pruebas locales limitadas | **No afirmar que no existen** | Pendiente |

El manifiesto de la rama [#787](https://github.com/ogarnelo/v0-community-marketplace/pull/787) ya documenta una ventana 10–20 noviembre: **251** solicitudes a rutas REST seleccionadas (185 con clave secreta y 66 con clave pública legada + JWT autenticado), **0** solicitudes identificadas con rol efectivo `anon` en esa muestra. **No acredita la ausencia de consumidores inactivos, móviles, externos ni consultas indirectas.** Cifras históricas, no vigilancia en tiempo real.

## Declaración concreta que debe emitir el propietario

Marcar cada apartado **Sí / No / Desconozco**, y añadir enlace/nota comprobable de inventario. No interpretar `No` como inexistencia universal si solo se revisó el repositorio. El responsable puede copiar las respuestas al [issue #787](https://github.com/ogarnelo/v0-community-marketplace/pull/787) para su firma documental.

- [ ] ¿Actualmente se ofrece WETUDY mediante alguna **app móvil nativa o compilación instalada** que use directamente Supabase? Identificar nombre, versión y contacto o manifestar alcance de la revisión.
- [ ] ¿Existen **otras webs, dashboards, micrositios o proyectos externos** (de proveedores, colegios o AMPAs) que compartan el proyecto/clave Supabase?
- [ ] ¿Hay **Make, Zapier, n8n, scripts locales, trabajos antiguos, cron externos o integraciones de terceros** que consuman la Data API, RPC o Realtime?
- [ ] ¿Se ha entregado **alguna clave pública `anon` o URL Supabase** a terceros para acceder sin iniciar sesión?
- [ ] ¿Se consulta externamente **`demand_opportunities_30d`** o alguna de las cinco tablas directamente **sin sesión**?
- [ ] ¿Hay **clientes antiguos o inactivos** que aún puedan seguir usando la API, aunque hoy no aparezcan en los logs observados?
- [ ] ¿Quién puede actuar como **revisor independiente** (persona distinta del propietario) para auditar snapshot de grants y rollback? Si no existe aún, responder *pendiente*, no firmarse a sí mismo.

## Siguiente puerta y condiciones de cierre

1. Recibir la declaración anterior del propietario, con su alcance real y evidencias. La asignación de responsable puede anotarse ya, pero **no es firma del inventario**.
2. Compararla con catálogo, configuración y registros; determinar dependencias invitadas y pruebas E2E necesarias. Mantener blocked donde haya `Desconozco` o fuentes no cubiertas.
3. Exigir **revisor independiente** y aceptación explícita del rollback de grants exactos; una única persona no cumple ambas funciones.
4. No fusionar #787 ni aplicar `REVOKE` hasta cerrar todas las puertas, CI del HEAD, autorización específica y plan de reversión.

**Prohibiciones:** no datos identificativos, credenciales, secretos ni URLs con tokens en comentarios; no modificar RLS, privilegios, banderas, registros de usuario ni despliegues por esta recopilación. Piloto general NO-GO.

**Norma permanente:** raíz `AGENTS.md`; índice `docs/pilot/WETUDY_START_HERE_CONTINUIDAD.md`; seguimiento [#767](https://github.com/ogarnelo/v0-community-marketplace/issues/767).
