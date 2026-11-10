-- Disposable PostgreSQL 17 regression. Loaded after the live-radius
-- fixture. NEVER run against a live Supabase project.
\i supabase/migrations/20261110204400_marketplace_school_link_invalidation_v2.sql

create table if not exists public.school_directory(
  official_code text primary key,
  linked_school_id uuid
);

insert into public.school_directory(official_code,linked_school_id)
values ('TEST-CODE','00000000-0000-4000-8000-000000000001');

do $$
begin
  if (select linked_school_id from public.school_directory
      where official_code='TEST-CODE')
     is distinct from '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Synthetic initial school directory link missing';
  end if;
end $$;

-- A school director relinks an existing code; the delivery worker must see
-- the new mapping and disqualify the old school match (tested in Node).
update public.school_directory
  set linked_school_id='00000000-0000-4000-8000-000000000002'
  where official_code='TEST-CODE';

do $$
begin
  if (select linked_school_id from public.school_directory
      where official_code='TEST-CODE')
     is distinct from '00000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'Stale directory mapping unexpectedly reused';
  end if;
end $$;

update public.saved_search_matches
  set invalidated_at=now(), invalidation_reason='school_link_changed'
  where id='10000000-0000-4000-8000-000000000024';

do $$
begin
  if (select invalidation_reason from public.saved_search_matches
      where id='10000000-0000-4000-8000-000000000024') <> 'school_link_changed' then
    raise exception 'School relinking invalidation was not persisted';
  end if;
  if exists (
    select 1 from public.saved_search_matches
    where id='10000000-0000-4000-8000-000000000024'
      and invalidated_at is null
  ) then
    raise exception 'Invalidated school recipient remained eligible for notification';
  end if;
  if (select invalidation_reason from public.saved_search_matches
      where id='20000000-0000-4000-8000-000000000001') <> 'radius_changed' then
    raise exception 'Radius invalidation lost compatibility after constraint upgrade';
  end if;
end $$;

do $$
begin
  begin
    update public.saved_search_matches
      set invalidation_reason='unexpected_input'
      where id='10000000-0000-4000-8000-000000000024';
    raise exception 'Invalid reason accepted';
  exception
    when check_violation then
      null;
  end;
end $$;

select 'PASS: live school relinking, two safe invalidation reasons and old radius compatibility' as result;
