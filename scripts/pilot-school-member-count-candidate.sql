-- Candidate ONLY for isolated PG QA, NOT a migration and NOT run in production.
-- Matches the existing app/admin/school/page.tsx membership-count semantics.
-- Return one aggregated count; never return names, student grades or family IDs.
create or replace function public.pilot_school_member_count(p_school_id uuid)
returns bigint
language sql stable security invoker
set search_path = public, pg_temp
as $$
  select count(*)
  from public.profiles p
  where
    exists (
      select 1 from public.account_students a
      where a.owner_user_id = p.id
        and a.active = true
        and a.school_id = p_school_id
    )
    or exists (
      select 1 from public.user_roles r
      where r.user_id = p.id
        and r.role = 'school_admin'
        and r.school_id = p_school_id
    )
    or (
      p.school_id = p_school_id
      and not exists (
        select 1 from public.account_students a
        where a.owner_user_id = p.id and a.active = true
      )
    );
$$;
revoke all on function public.pilot_school_member_count(uuid) from public, anon, authenticated;
grant execute on function public.pilot_school_member_count(uuid) to service_role;
