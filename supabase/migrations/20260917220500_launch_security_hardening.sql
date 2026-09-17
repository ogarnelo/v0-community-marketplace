-- Launch hardening: use role-based superadmin checks, make aggregate views obey
-- caller RLS, make legacy RLS lockdown explicit, add safe school-request metadata,
-- and index the MVP hot paths.

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin'
  );
$$;

revoke all on function public.is_superadmin() from public;
revoke all on function public.is_superadmin() from anon;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_superadmin() to service_role;

alter view public.marketplace_demand_summary set (security_invoker = true);
alter view public.saved_search_demand_summary set (security_invoker = true);
revoke all on public.marketplace_demand_summary from anon;
revoke all on public.saved_search_demand_summary from anon;
grant select on public.marketplace_demand_summary to authenticated;
grant select on public.saved_search_demand_summary to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'donation_request_events',
    'listing_offer_events',
    'listing_offers',
    'school_admins',
    'school_codes'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'legacy_locked_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      'legacy_locked_' || table_name,
      table_name
    );
  end loop;
end
$$;

alter table public.school_registration_requests
  add column if not exists requested_by uuid references auth.users(id) on delete set null;

create index if not exists school_registration_requests_requested_by_created_at_idx
  on public.school_registration_requests (requested_by, created_at desc)
  where requested_by is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.school_registration_requests'::regclass
      and conname = 'school_registration_requests_school_name_length'
  ) then
    alter table public.school_registration_requests
      add constraint school_registration_requests_school_name_length
      check (school_name is null or char_length(trim(school_name)) between 2 and 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.school_registration_requests'::regclass
      and conname = 'school_registration_requests_postal_code_format'
  ) then
    alter table public.school_registration_requests
      add constraint school_registration_requests_postal_code_format
      check (postal_code is null or postal_code ~ '^[0-9]{5}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.school_registration_requests'::regclass
      and conname = 'school_registration_requests_school_type_allowed'
  ) then
    alter table public.school_registration_requests
      add constraint school_registration_requests_school_type_allowed
      check (school_type in ('school', 'academy', 'university'));
  end if;
end
$$;

create or replace function public.notify_superadmins_on_school_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (
    user_id,
    kind,
    title,
    body,
    href,
    metadata
  )
  select
    ur.user_id,
    'school_registration_requested',
    'Nueva solicitud de centro',
    'Solicitud pendiente: ' || left(coalesce(new.school_name, 'Centro sin nombre'), 120) || '.',
    '/admin/super',
    jsonb_build_object(
      'school_request_id', new.id,
      'requester_user_id', new.requested_by
    )
  from public.user_roles ur
  where ur.role = 'super_admin';

  return new;
end;
$$;

revoke all on function public.notify_superadmins_on_school_request() from public;
revoke all on function public.notify_superadmins_on_school_request() from anon;
revoke all on function public.notify_superadmins_on_school_request() from authenticated;

drop trigger if exists school_request_notify_superadmins on public.school_registration_requests;
create trigger school_request_notify_superadmins
after insert on public.school_registration_requests
for each row
execute function public.notify_superadmins_on_school_request();

-- MVP hot-path foreign-key indexes.
create index if not exists listings_seller_id_idx on public.listings (seller_id);
create index if not exists listings_school_id_idx on public.listings (school_id);
create index if not exists listing_photos_listing_id_idx on public.listing_photos (listing_id);
create index if not exists conversations_buyer_id_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_id_idx on public.conversations (seller_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists reports_listing_id_idx on public.reports (listing_id);
create index if not exists reports_conversation_id_idx on public.reports (conversation_id);
create index if not exists profiles_school_id_idx on public.profiles (school_id);
create index if not exists agreement_reviews_listing_id_idx on public.agreement_reviews (listing_id);
create index if not exists reviews_listing_id_idx on public.reviews (listing_id);
create index if not exists reviews_reviewer_id_idx on public.reviews (reviewer_id);
create index if not exists reviews_reviewed_user_id_idx on public.reviews (reviewed_user_id);
create index if not exists school_registration_requests_approved_school_id_idx
  on public.school_registration_requests (approved_school_id);
create index if not exists school_registration_requests_reviewed_by_idx
  on public.school_registration_requests (reviewed_by);
create index if not exists marketplace_search_events_user_id_idx
  on public.marketplace_search_events (user_id);
create index if not exists demand_match_notifications_listing_id_idx
  on public.demand_match_notifications (listing_id);
