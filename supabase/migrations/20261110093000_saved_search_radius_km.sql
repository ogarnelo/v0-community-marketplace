-- Store the radius a user actually selected in a saved marketplace search.
-- NULL means no geographic limit. No existing row is rewritten.
alter table public.saved_searches
  add column if not exists radius_km integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.saved_searches'::regclass
      and conname = 'saved_searches_radius_km_bounds'
  ) then
    alter table public.saved_searches
      add constraint saved_searches_radius_km_bounds
      check (radius_km is null or radius_km between 1 and 200);
  end if;
end $$;

notify pgrst, 'reload schema';
