alter table public.schools
  add column if not exists is_test boolean not null default false;

update public.schools
set is_test = true
where lower(name) like '%test%';

update public.schools
set is_active = true,
    is_test = true
where id = 'acf4f9db-abdb-43a5-8b54-8b98d2464073';

comment on column public.schools.is_test is
  'Centro de QA interno. Puede estar activo para pruebas directas pero debe ocultarse del descubrimiento público.';
