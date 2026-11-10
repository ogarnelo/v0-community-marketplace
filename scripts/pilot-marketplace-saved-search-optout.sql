-- Disposable PostgreSQL17 fixture. Do not run against production.
-- The prior fixtures created wetudy_internal and the outbox. All rows here
-- are synthetic and discarded with the GitHub Actions service.
create table public.saved_searches(
  id uuid primary key,
  user_id uuid not null,
  query text,
  isbn_query text,
  category text,
  grade_level text,
  listing_type text,
  condition text,
  only_my_community boolean,
  school_id text,
  directory_school_code text,
  radius_km integer,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
\i supabase/migrations/20261110161700_saved_search_preference_stamp_v1.sql

do $$
begin
  if has_function_privilege('anon',
        'wetudy_internal.saved_search_preference_stamp_v1()','execute')
     or has_function_privilege('authenticated',
        'wetudy_internal.saved_search_preference_stamp_v1()','execute')
     or has_schema_privilege('authenticated','wetudy_internal','usage') then
    raise exception 'Stamp function exposed to browser roles';
  end if;
end $$;

insert into public.saved_searches(id,user_id,query,category,notifications_enabled,created_at,updated_at)
values
('10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000001',
 'polo azul','Uniformes',true,now()-interval '2 days',now()-interval '1 day'),
('10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000001',
 'mochila', 'Mochilas',true,now()-interval '2 days',now()-interval '1 day');

-- Attempts to opt out MUST change updated_at even when the browser does not
-- send that column, and even if it tries to spoof an older timestamp.
update public.saved_searches set notifications_enabled=false,
  updated_at=now()-interval '20 days'
where id='10000000-0000-4000-8000-000000000020';

do $$
begin
  if (select notifications_enabled from public.saved_searches
      where id='10000000-0000-4000-8000-000000000020') <> false
     or (select updated_at from public.saved_searches
      where id='10000000-0000-4000-8000-000000000020') < now()-interval '5 minutes' then
    raise exception 'Opt-out did not update revision timestamp';
  end if;
end $$;

-- Re-enable after an old listing was published does NOT resurrect the
-- historical notification, because updated_at remains more recent.
update public.saved_searches set notifications_enabled=true
where id='10000000-0000-4000-8000-000000000020';
do $$
begin
  if (select updated_at from public.saved_searches
      where id='10000000-0000-4000-8000-000000000020') < now()-interval '5 minutes' then
    raise exception 'Re-enabled search incorrectly retained stale timestamp';
  end if;
end $$;

-- Criteria updates stamp the same preference revision.
update public.saved_searches set category='Libros', radius_km=10
where id='10000000-0000-4000-8000-000000000021';
do $$
begin
  if (select updated_at from public.saved_searches
      where id='10000000-0000-4000-8000-000000000021') < now()-interval '5 minutes' then
    raise exception 'Criteria update did not advance search revision';
  end if;
end $$;

-- Recovered deliveries must ignore searches whose revision is newer than
-- the listing, even when someone opts IN again after opting out.
insert into public.saved_searches(id,user_id,query,category,notifications_enabled,created_at,updated_at)
values
('10000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000001',
 'libros tercero','Libros',true,now()-interval '2 days',now()-interval '1 day');
alter table public.saved_search_matches
  add column if not exists saved_search_id uuid references public.saved_searches(id);
insert into public.saved_search_matches(id,saved_search_id) values
 ('10000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000020'),
 ('10000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000021'),
 ('10000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000022');
do $optout$
declare
  eligible_count integer;
begin
  select count(*) into eligible_count
    from public.saved_search_matches m
    join public.saved_searches s on s.id=m.saved_search_id
    where s.notifications_enabled is true
      and s.updated_at <= now()-interval '30 minutes';
  if eligible_count <> 1 then
    raise exception 'Old listing opt-out and changed preferences were not excluded';
  end if;
end $optout$;

-- Legacy rows that have never changed retain their original timestamp;
-- migration does not backfill or rewrite any saved search.
select 'PASS: opt-out/opt-in, changed criteria and anti-timestamp-spoof trigger' as result;
