# WETUDY · 16 permisos futuros de `supabase_admin` — ejecución pendiente por propietario

Estado comprobado en Education Marketplace (`jpsljmakoscqevssimtk`) el **19/11/2026**. **No aplicado**: sin actor autorizado disponible en esta conexión. No es una migración automática y no está en `supabase/migrations`.

## Hechos comprobados, no supuestos

- `current_user=session_user=postgres`, `is_superuser=off`.
- `supabase_admin` es superusuario administrado por Supabase; `postgres` **NO** es miembro de `supabase_admin` y **NO** puede `SET ROLE supabase_admin`.
- En `pg_default_acl` para `public` y el propietario `supabase_admin`, los roles `anon` y `authenticated` reciben **8 privilegios cada uno** para **futuras tablas**: INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN.
- Son privilegios automáticos de objetos **futuros**, no los permisos de tablas existentes ni la implementación actual de RLS.
- Para tablas nuevas propiedad de `postgres`, la ACL por defecto ya fue reducida en la migración `20261115190257`. No confundir propietarios.

## Operación preparada

Archivo `scripts/p0_supabase_admin_owner_only_default_acl_handoff.sql`, **solo para ejecución por personal/operador legítimamente autenticado como `supabase_admin`**. Su preflight falla si no se cumple ese requisito o si la ACL ha derivado de 16 permisos. La transacción:

1. Verifica propietario, esquema y 16 derechos futuros actuales de `anon`/`authenticated`.
2. Guarda una instantánea exacta de los derechos preexistentes de `postgres` y `service_role` para ese propietario/esquema.
3. Ejecuta únicamente `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`.
4. Comprueba **cero** privilegios futuros cliente y permanencia exacta de los derechos de `postgres`/`service_role`. Cualquier fallo aborta la transacción.

No realizar `GRANT supabase_admin TO postgres`, suplantar al administrador, extraer credenciales de plataforma, modificar la configuración de roles ni ampliar privilegios para eludir la restricción. Un SQL Editor ordinario conectado como `postgres` no resuelve este bloqueo.

## Cómo desbloquearlo

Solicitar a soporte/operaciones de Supabase que revise la ACL del proyecto **sin enviar claves ni credenciales** y aplique el script con el rol apropiado o proporcione mecanismo oficial compatible. En el informe de operaciones incluir las versiones de migraciones aplicadas ya verificadas y pedir el resultado de las consultas de postflight, sin datos personales.

Mientras tanto, **solo** ese ítem de ACL queda bloqueado; el desarrollo, QA sintética y PR de producto pueden continuar. El piloto general no se abre por cerrar estas ACL.

## Validación no productiva

El script de PostgreSQL 17 aislado del repositorio reproduce los roles ficticios y los 16 grants, aplica el mismo `ALTER DEFAULT PRIVILEGES`, verifica que cliente obtiene 0 y que service-role/owner permanece; la prueba no se ejecuta en Education Marketplace.
