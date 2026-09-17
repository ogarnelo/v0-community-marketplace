-- Once the server-side school request endpoint is live, prevent browser clients
-- from bypassing its confirmation, account-age, rate-limit and validation checks.
drop policy if exists school_registration_requests_insert_authenticated
  on public.school_registration_requests;

drop policy if exists school_registration_requests_insert_public
  on public.school_registration_requests;

revoke insert on table public.school_registration_requests from anon;
revoke insert on table public.school_registration_requests from authenticated;
