-- Reject parent/student sign-ups with postal codes outside Spain's province prefixes.
-- School/admin flows without these user types are left untouched.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  role_value text;
  postal_value text;
  postal_prefix integer;
begin
  role_value := nullif(trim(new.raw_user_meta_data ->> 'user_type'), '');
  postal_value := nullif(trim(new.raw_user_meta_data ->> 'postal_code'), '');

  if role_value in ('parent', 'student') then
    if postal_value is null or postal_value !~ '^[0-9]{5}$' then
      raise exception 'invalid_spanish_postal_code' using errcode = 'P0001';
    end if;

    postal_prefix := substring(postal_value from 1 for 2)::integer;
    if postal_prefix < 1 or postal_prefix > 52 then
      raise exception 'invalid_spanish_postal_code' using errcode = 'P0001';
    end if;
  end if;

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
    role_value,
    nullif(trim(new.raw_user_meta_data ->> 'grade_level'), ''),
    postal_value
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
$function$;
