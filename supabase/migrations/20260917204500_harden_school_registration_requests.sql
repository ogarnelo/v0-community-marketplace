-- School registration requests are moderation submissions, never public schools.
-- Only authenticated users may create them; superadmins keep review access via existing policies.

begin;

revoke insert on table public.school_registration_requests from anon;

drop policy if exists school_registration_requests_insert_public
  on public.school_registration_requests;

drop policy if exists school_registration_requests_insert_authenticated
  on public.school_registration_requests;

create policy school_registration_requests_insert_authenticated
  on public.school_registration_requests
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

commit;
