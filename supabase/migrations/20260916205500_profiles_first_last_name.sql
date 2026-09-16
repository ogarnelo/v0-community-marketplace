-- Store personal names in separate fields while keeping full_name for backwards compatibility.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

-- Best-effort backfill for legacy profiles. Future writes use the dedicated fields directly.
update public.profiles
set
  first_name = coalesce(
    first_name,
    nullif(substring(btrim(full_name) from '^\S+'), '')
  ),
  last_name = coalesce(
    last_name,
    nullif(btrim(regexp_replace(btrim(full_name), '^\S+\s*', '')), '')
  )
where full_name is not null
  and btrim(full_name) <> ''
  and (first_name is null or last_name is null);

comment on column public.profiles.first_name is 'User given name, stored separately from surnames.';
comment on column public.profiles.last_name is 'User surnames, stored separately from given name.';
