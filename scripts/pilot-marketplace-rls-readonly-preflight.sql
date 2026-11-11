-- WETUDY pilot | Read-only RLS metadata drift gate (11 November 2026)
-- Run via an authorized SQL connection. Does NOT read family rows or modify schema.
-- This is not a substitute for authenticated RLS runtime tests.
begin transaction read only;

do $wetudy$
declare
  tbl text;
  checked integer := 0;
begin
  -- Every affected table must exist and have row-level security enabled.
  foreach tbl in array array[
    'saved_searches', 'saved_search_matches', 'user_marketplace_preferences',
    'marketplace_alert_outbox','marketplace_postal_centroids',
    'transactional_email_deliveries'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=tbl and c.relkind in ('r','p')
        and c.relrowsecurity
    ) then
      raise exception 'P0 RLS metadata drift: missing RLS table %',tbl;
    end if;
    checked:=checked+1;
  end loop;

  -- Match records are system-owned. A family may view or remove its own
  -- match but may NOT directly insert/update the record or its email flags.
  if exists (
    select 1 from pg_policies p where p.schemaname='public'
      and p.tablename='saved_search_matches'
      and p.cmd in ('INSERT','UPDATE','ALL')
      and (p.roles && array['public','authenticated','anon'])
  ) then raise exception 'P0 RLS metadata drift: client match write policy'; end if;
  if not exists (
    select 1 from pg_policies p where p.schemaname='public'
      and p.tablename='saved_search_matches' and p.cmd='SELECT'
      and 'authenticated'=any(p.roles)
      and p.qual ilike '%auth.uid()%'
      and p.qual ilike '%user_id%'
  ) then raise exception 'P0 RLS metadata drift: owner match SELECT'; end if;

  -- A family can create/update only its own saved-search and preferences.
  foreach tbl in array array['saved_searches','user_marketplace_preferences'] loop
    if not exists (
      select 1 from pg_policies p where p.schemaname='public' and p.tablename=tbl
      and p.cmd='INSERT' and 'authenticated'=any(p.roles)
      and p.with_check ilike '%auth.uid()%' and p.with_check ilike '%user_id%'
    ) then raise exception 'P0 RLS metadata drift: owner INSERT on %',tbl; end if;
    if not exists (
      select 1 from pg_policies p where p.schemaname='public' and p.tablename=tbl
      and p.cmd='UPDATE' and 'authenticated'=any(p.roles)
      and p.qual ilike '%auth.uid()%' and p.qual ilike '%user_id%'
      and p.with_check ilike '%auth.uid()%' and p.with_check ilike '%user_id%'
    ) then raise exception 'P0 RLS metadata drift: owner UPDATE on %',tbl; end if;
    if exists (
      select 1 from pg_policies p where p.schemaname='public' and p.tablename=tbl
      and p.cmd in ('INSERT','UPDATE','ALL')
      and (p.roles && array['public','anon'])
    ) then raise exception 'P0 RLS metadata drift: broad write policy on %',tbl; end if;
  end loop;

  -- No family or unauthenticated SQL role may mutate operational outbox,
  -- postal-centroid basemap or provider delivery receipts.
  foreach tbl in array array[
    'marketplace_alert_outbox','marketplace_postal_centroids',
    'transactional_email_deliveries'
  ] loop
    if has_table_privilege('anon','public.'||tbl,'INSERT')
      or has_table_privilege('anon','public.'||tbl,'UPDATE')
      or has_table_privilege('authenticated','public.'||tbl,'INSERT')
      or has_table_privilege('authenticated','public.'||tbl,'UPDATE')
    then raise exception 'P0 RLS metadata drift: direct client write grant on %',tbl; end if;
  end loop;

  -- Service role may have its own delivery policy; client roles cannot.
  if exists (
    select 1 from pg_policies p where p.schemaname='public'
      and p.tablename='transactional_email_deliveries'
      and (p.roles && array['public','anon','authenticated'])
  ) then raise exception 'P0 RLS metadata drift: public email receipt policy'; end if;

  raise notice 'PASS WETUDY: RLS metadata/privilege gate, % public tables checked; no family rows read',checked;
end
$wetudy$;

commit;
