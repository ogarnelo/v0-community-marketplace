-- Distinguish an unactivated national-directory school from an operational
-- Wetudy school when families save a school-scoped demand.
-- Null is intentional for searches without directory school context.
-- No data backfill or changes to school activation.
alter table public.saved_searches
  add column if not exists directory_school_code text
  references public.school_directory(official_code) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.saved_searches'::regclass
      and conname = 'saved_searches_one_school_reference_chk'
  ) then
    alter table public.saved_searches
      add constraint saved_searches_one_school_reference_chk
      check (school_id is null or directory_school_code is null);
  end if;
end $$;

-- Existing RLS policy ownership still protects every search.
notify pgrst, 'reload schema';
