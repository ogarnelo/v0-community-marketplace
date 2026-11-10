-- PostgreSQL 17 disposable fixture. Run ONLY after saved-search opt-out
-- fixture in the GitHub Actions service; never on live Supabase.
create table public.saved_search_matches (
  id uuid primary key,
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null,
  notified_at timestamptz,
  emailed_at timestamptz,
  email_skipped_at timestamptz,
  unique (saved_search_id, listing_id)
);

\i supabase/migrations/20261110164500_saved_search_match_delivery_invalidation.sql

do $$
begin
  if (select count(*) from public.saved_search_matches) <> 0 then
    raise exception 'Migration must not rewrite any existing recipient matches';
  end if;
end $$;

-- The previously-created test saved searches remain synthetic. One match
-- stays valid and another is invalidated after a simulated profile move.
insert into public.saved_search_matches(id,saved_search_id,listing_id,user_id)
values
('20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000020',
 '00000000-0000-4000-8000-000000000011',
 '10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000021',
 '00000000-0000-4000-8000-000000000011',
 '10000000-0000-4000-8000-000000000001');

update public.saved_search_matches
set invalidated_at=now(), invalidation_reason='radius_changed'
where id='20000000-0000-4000-8000-000000000001';

do $$
begin
  if (select count(*) from public.saved_search_matches
      where listing_id='00000000-0000-4000-8000-000000000011'
        and notified_at is null and invalidated_at is null) <> 1 then
    raise exception 'Invalidated recipient appeared in a pending notification query';
  end if;
  if (select count(*) from public.saved_search_matches
      where listing_id='00000000-0000-4000-8000-000000000011'
        and emailed_at is null and email_skipped_at is null
        and invalidated_at is null) <> 1 then
    raise exception 'Invalidated recipient appeared in a pending email query';
  end if;
  if (select invalidation_reason from public.saved_search_matches
      where id='20000000-0000-4000-8000-000000000001') <> 'radius_changed' then
    raise exception 'Invalidation reason was not persisted';
  end if;
end $$;

select 'PASS: radius change invalidation excludes both channels without deleting prior matches' as result;
