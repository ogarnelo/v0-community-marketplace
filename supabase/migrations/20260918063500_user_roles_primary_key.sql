-- Give user_roles an explicit row identity. Existing authorization remains based on
-- user_id/role/school_id and the current partial unique indexes stay unchanged.
alter table public.user_roles
  add column if not exists id uuid default gen_random_uuid();

update public.user_roles
set id = gen_random_uuid()
where id is null;

alter table public.user_roles
  alter column id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype = 'p'
  ) then
    alter table public.user_roles
      add constraint user_roles_pkey primary key (id);
  end if;
end
$$;
