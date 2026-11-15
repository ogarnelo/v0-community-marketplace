# WETUDY — PR534: evitar que las próximas tablas nazcan expuestas
Fecha 15/11/2026. Propuesta SIN aplicar a Supabase productivo.

## Evidencia real (consultas pg_default_acl exclusivamente)
En Supabase Education Marketplace, dos propietarios `postgres` y `supabase_admin` conceden en `public`, cada uno a `anon` y `authenticated`, estos ocho privilegios por defecto para tablas nuevas:
SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN (32 entradas catalogadas, 16 por propietario).
No se han encontrado default table grants **globales** para estos dos propietarios. Existen otros defaults específicos en `storage`, `graphql` y `graphql_public`; esta propuesta NO cambia esos esquemas ni afecta a tablas ya existentes.

## Propuesta SQL
`scripts/p0_public_default_acl_review_only.sql` revoca exclusivamente los grants **por defecto** de tablas futuras `public` para ambos propietarios y ambos roles cliente. Solo permite baseline exactamente 32 o 0 (repetición), comprueba ausencia de defaults globales que anularían la medida, usa BEGIN/COMMIT y postflight que exige cero grants residuales. Si faltan privilegios para modificar defaults de `supabase_admin`, debe fallar antes de confirmar la transacción; nunca forzar un rol distinto sin revisión.

Este cambio NO afecta tablas existentes ni elimina filas. Pero **SÍ cambia la compatibilidad futura**: nuevas tablas que deban ser accesibles desde el navegador necesitarán GRANT SELECT/INSERT/UPDATE/DELETE explícito tras habilitar RLS y justificarlo. Por tanto requiere revisión de despliegues y autorización productiva separada.

## Evidencias / pruebas
`scripts/p0_public_default_acl_pg17.py` usa únicamente PostgreSQL 17 local y una base desechable; simula ambos propietarios, conserva grants de tabla preexistente, crea dos tablas después del cambio y comprueba que ninguno de los ocho privilegios se concede a anon/auth; prueba idempotencia y drift fail-closed. Conectado al workflow de Postgres/Storage local.

## Orden de salida
1. Cerrar tras aprobación la PR533 sobre las 48 tablas existentes; no ejecutar antes sin autorización.
2. Aprobar por separado esta PR534 sobre `ALTER DEFAULT PRIVILEGES` y dejar claro que nuevas tablas requieren grants explícitos.
3. En caso de aprobación, aplicar transaccionalmente con Supabase y verificar sólo catálogos y smoke de www.wetudy.com.
4. E2E familias y las tres AMPA (0/3), DR integral pendiente: apertura general sigue NO-GO.
Documentación PostgreSQL: https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html .
