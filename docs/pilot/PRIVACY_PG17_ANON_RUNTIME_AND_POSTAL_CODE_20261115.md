# WETUDY — Privacidad #447: contrato de comportamiento, no solo GRANT

Fecha 15/11/2026. Solo QA, nada en main ni producción.

## Qué ya probábamos
En un PostgreSQL 17 efímero aplicamos la propuesta de revocar SELECT de anon seguida de la propuesta independiente de revocar INSERT, UPDATE y DELETE. Las aserciones de catálogo confirman `has_table_privilege` y preservación de DML del vendedor autenticado, y no certifican producción.

## Nuevo ensayo de acciones efectivas
El script `scripts/pilot-ci-privacy-actual-roles-runtime.sh` se ejecuta *solo en GitHub Actions* con `PGHOST=127.0.0.1`, DB sintética `wetudy_privacy_ci` y contraseña CI fija de prueba. Sin conexión con Supabase ni personas reales.

Verifica acciones SQL con `SET LOCAL ROLE anon`: SELECT de CP, INSERT, UPDATE y DELETE deben fallar con SQLSTATE 42501 tras aplicar las dos propuestas. También realiza INSERT/UPDATE de CP del propietario autenticado usando UUID ficticio, comprueba que el UPDATE cruzado no modifica el CP ajeno, agrega una política SELECT sintética necesaria solo para el escenario y ejecuta `ROLLBACK`. Verifica cero filas y política temporal ausente.

## Límites que NO quedan certificados
La protección del CP ante solicitudes HTTP de PostgREST ni los lectores públicos del marketplace. Para ello se necesita revisión del código E2E y la migración autorizada. No aplicar estas propuestas todavía sobre producción. La retirada de grants anónimos es defensa en profundidad; las políticas RLS productivas ya pueden impedir DML sin necesidad de este cambio.

## Dependencias
No invitar a las 3 AMPA hasta cerrar privacidad #447 y recuperación #455, y obtener aprobación explícita. Documentar impacto de SELECT anon en todos los consumidores antes de cualquier cambio productivo. La apertura 26/11/2026 es condicionada.