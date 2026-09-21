-- Move the privileged RLS helper out of the exposed public schema.
-- The public wrapper remains SECURITY INVOKER for backwards compatibility with
-- existing policies and server code, while the privileged lookup lives in a
-- non-exposed schema as recommended by Supabase.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  );
$$;

revoke all on function private.is_superadmin() from public;
revoke all on function private.is_superadmin() from anon;
grant execute on function private.is_superadmin() to authenticated;
grant execute on function private.is_superadmin() to service_role;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_superadmin();
$$;

revoke all on function public.is_superadmin() from public;
revoke all on function public.is_superadmin() from anon;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_superadmin() to service_role;
