create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    full_name,
    user_type,
    grade_level,
    postal_code
  )
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'user_type'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'grade_level'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'postal_code'), '')
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name,
    user_type = excluded.user_type,
    grade_level = excluded.grade_level,
    postal_code = excluded.postal_code;

  return new;
end;
$$;
