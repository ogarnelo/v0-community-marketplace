-- A saved search must not receive a recovery alert based on preferences
-- changed AFTER the matching listing was published. The worker remains OFF.
-- Existing rows are not modified and the ordinary seller dispatch is intact.
-- Stamp EVERY update that can affect matching or notification consent.
create or replace function wetudy_internal.saved_search_preference_stamp_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function wetudy_internal.saved_search_preference_stamp_v1()
  from public, anon, authenticated;

drop trigger if exists saved_search_preference_stamp_before_update_v1
  on public.saved_searches;
create trigger saved_search_preference_stamp_before_update_v1
  before update of notifications_enabled, query, isbn_query, category,
    grade_level, listing_type, condition, only_my_community,
    school_id, directory_school_code, radius_km, user_id, updated_at
  on public.saved_searches
  for each row execute function
    wetudy_internal.saved_search_preference_stamp_v1();

-- No new tables, no network calls and no emails.
