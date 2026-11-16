# PR602 — Guardia autónoma nocturna de WETUDY (17/11/2026)

**Motivo:** el responsable quiere progreso técnico durante la noche, pero ChatGPT respondió con límite de 5/5 tareas programadas activas y rechazó la creación de una sexta. Para no desactivar ninguna sin permiso, se añade una opción limitada de GitHub Actions, no un agente de programación con acceso total.

**Calendario:** `workflow_dispatch` manual o cron `20 0,2,4 17 11 *` (00:20, 02:20, 04:20 UTC = 01:20, 03:20, 05:20 CET Madrid el 17/11/2026). Guardia por fecha `2026-11-17`: las ejecuciones futuras después de este día NO realizan verificaciones. Los cron de GitHub son de mejor esfuerzo y pueden retrasarse; no se promete puntualidad exacta. No es una vigilancia persistente.

**Acción:** checkout sin guardar credenciales, Node 22 sin instalar dependencias, pruebas estáticas de revisión RLS del P0 #591 y smoke de 3 GET anónimos en `https://www.wetudy.com`. Resumen permanente de ejecución en GitHub Actions y error CI cuando un contrato falla.

**Seguridad y gastos:** sin Supabase, secretos de proveedores, correos, pagos, respaldo, migraciones ni escrituras. Token de GitHub limitado a `contents: read`. Tiempo máximo 5 minutos por ejecución: 3 ejecuciones planificadas, sin utilización de Vercel para pruebas adicionales. Las PR siguen fusionándose únicamente de forma interactiva tras CI/preview; la guardia NO genera ni fusiona PR y no equivale a un agente autónomo de desarrollo.

**Límites:** sin sesiones reales, RLS productivo, DR conjunto ni autorización AMPA; piloto **NO-GO**. Se conservan las 5 automatizaciones existentes; para añadir una tarea autónoma de ChatGPT habrá que liberar una plaza o usar un entorno de ejecución compatible distinto.
