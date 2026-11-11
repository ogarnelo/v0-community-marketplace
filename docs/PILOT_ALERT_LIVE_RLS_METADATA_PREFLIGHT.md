# WETUDY — Puerta de metadatos RLS reales antes del piloto

11/11/2026. P0 #375.

Se ha creado `scripts/pilot-marketplace-rls-readonly-preflight.sql` y se ha ejecutado con éxito contra **Education Marketplace** mediante una conexión de solo lectura para las familias: `BEGIN TRANSACTION READ ONLY`, sin abrir filas personales ni cambiar objetos.

El control inspecciona seis tablas sensibles: búsquedas, coincidencias, preferencias, outbox, centroides postales y recibos. Exige RLS habilitado, políticas de INSERT/UPDATE por propietario (`auth.uid()=user_id`) y ausencia de políticas de escritura de coincidencias accesibles a clientes. Outbox, centroides y recibos carecen de grants INSERT/UPDATE a `anon` o `authenticated`. Los recibos no pueden tener políticas de cliente.

**Hallazgo importante:** PostgreSQL puede conceder un `GRANT INSERT/UPDATE` amplio en búsquedas/coincidencias, pero sin la política RLS adecuada una operación sigue bloqueada. Los grants por sí solos no determinan la exposición. Este preflight combina ambos metadatos, pero **no ejecuta sesiones reales JWT** ni prueba ataques de explotación: el runtime RLS se ensaya solo con datos sintéticos por las PR #401–402.

Se añade a la suite crítica un contrato que exige el modo read-only y prohíbe DML/DDL. Si cambian políticas o privilegios, repetir el SQL y no activar el worker hasta revisar el resultado.

**Producción sigue como estaba:** seis DEMO, cero outbox, 93 migraciones registradas, cinco migraciones pendientes y dos banderas de activación ausentes. No se envían correos, no se crean usuarios ni ramas Supabase facturables. #375 permanece abierta.
