-- Restrict private profile data to its owner (plus superadmin) while keeping
-- safe cross-user presentation data behind audited server-side reads.
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_select_own_or_superadmin on public.profiles;

create policy profiles_select_own_or_superadmin
on public.profiles
for select
to authenticated
using (
  ((select auth.uid()) = id)
  or (select public.is_superadmin())
);

-- School codes are secrets used to join a community. Normal authenticated
-- users resolve an exact code through a server route instead of enumerating
-- active codes through the Data API. School admins may still read the code
-- for the school they administer; superadmins keep full access.
drop policy if exists school_access_codes_select_authorized on public.school_access_codes;

create policy school_access_codes_select_authorized
on public.school_access_codes
for select
to authenticated
using (
  (select public.is_superadmin())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'school_admin'
      and ur.school_id = school_access_codes.school_id
  )
);
