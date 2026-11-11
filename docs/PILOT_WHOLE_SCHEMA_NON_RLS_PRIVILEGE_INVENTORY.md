# WETUDY — Inventario integral de privilegios no protegidos por RLS

**11 de noviembre de 2026 · Incidencia #375 · No aplicado ningún cambio de permisos en producción**

## Hallazgo verificado (solo metadatos de Supabase)

La base PostgreSQL 17.6 de Education Marketplace contiene **79 tablas públicas**. Al consultar `pg_class` y `has_table_privilege`:

- Rol `anon`: **48 de 79** tablas tienen `TRUNCATE`.
- Rol `authenticated`: **49 de 79** tablas tienen `TRUNCATE`.
- También se observan `TRIGGER` en esas mismas cantidades. El inventario consulta adicionalmente `REFERENCES` y `MAINTAIN`.
- Entre las tablas afectadas figuran `profiles`, `listings`, `schools`, `saved_searches`, `saved_search_matches` y `user_roles`.

**Alcance exacto del riesgo:** PostgreSQL no aplica RLS a `TRUNCATE` ni `REFERENCES`. Supabase no ofrece TRUNCATE desde su Data API habitual y `anon` / `authenticated` no son roles con conexión SQL directa. Por ello **no hay evidencia de un ataque ni de una forma de vaciar tablas desde el navegador**. La sobreasignación importa ante funciones inseguras, mal uso de `SET ROLE`, contextos SQL delegados o futuras funcionalidades.

## Privilegios predeterminados: riesgo de recurrencia

Una segunda consulta de solo lectura a `pg_default_acl` muestra que tanto los objetos creados por `postgres` como los creados por `supabase_admin` reciben por defecto `TRUNCATE`, `REFERENCES`, `TRIGGER` y `MAINTAIN` para `anon` y `authenticated`.

La migración de PR #405 revoca esos cuatro privilegios **solo en tres tablas**; ni cambia el resto de tablas ni modifica los valores predeterminados. Nuevos objetos podrán volver a recibir concesiones anchas.

Supabase documenta que no se pueden modificar desde un usuario normal los privilegios predeterminados internos del creador `supabase_admin`. No improvisar `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` ni prometer que una revocación individual afectará objetos futuros.

## Herramienta de comprobación

`scripts/pilot-client-tablewide-privileges-inventory.sql` abre transacción `READ ONLY` y muestra cantidades, nombres de tablas afectadas y ACL predeterminadas, **sin consultar una sola fila de usuarios**. Se incluye una prueba de contrato que prohíbe DDL o DML.

## Plan seguro

1. Priorizar por impacto los datos de familias, colegios, anuncios, mensajes y pagos; revisar los permisos efectivos y cualquier función SQL que pueda ejecutar instrucciones con rol cliente.
2. Preparar una revocación coordinada para las tablas identificadas, preservar los grants DML justificados y obtener una regresión PostgreSQL aislada que demuestre compatibilidad.
3. Acordar estrategia para objetos nuevos y privilegios del creador; usar mecanismos documentados por Supabase.
4. Aplicar solo tras verificar recuperación/rollback y una ventana de pruebas, con consultas de metadatos antes y después.

La incidencia #375 permanece **ABIERTA**. Las cinco migraciones de avisos y la nueva migración de permisos siguen fuera del esquema de producción; no activar el recuperador.
 
Referencias:
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema-448af9
- https://www.postgresql.org/docs/17/ddl-rowsecurity.html
