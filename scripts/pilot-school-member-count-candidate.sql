-- Versioned source for proposed member-count RPC. Needs explicit application before server UI change.
-- A member means a profile that is: (a) attached to active students of the school,
-- (b) a school_admin for the school, or (c) has profile.school_id and no active
-- educational context anywhere. Dedup family profiles with multiple children.
-- Use narrow, indexed source sets rather than a global full-profile scan.
create or replace function public.server_school_member_count(p_school_id uuid)
returns bigint
language sql stable security invoker
set search_path = public, pg_temp
as $$
  select count(*)
  from (
    select p.id from public.profiles p
      where p.school_id = p_school_id
        and not exists (
          select 1 from public.account_students a
          where a.owner_user_id = p.id and a.active = true
        )
    union
    select p.id from public.account_students a
      join public.profiles p on p.id = a.owner_user_id
      where a.active = true and a.school_id = p_school_id
    union
    select p.id from public.user_roles r
      join public.profiles p on p.id = r.user_id
      where r.role = 'school_admin' and r.school_id = p_school_id
  ) member_profiles;
$$;
-- Service-role only: the page checks the current user's school_admin role
-- before using this RPC. Never expose this aggregate to browser tokens.
revoke all on function public.server_school_member_count(uuid) from public, anon, authenticated;
grant execute on function public.server_school_member_count(uuid) to service_role;
