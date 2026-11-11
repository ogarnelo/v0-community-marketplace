-- Local PostgreSQL17 ONLY: isolated six-table RLS policy catalog, no families.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable
as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.is_superadmin() returns boolean language sql stable
as $$select false$$;
create table public.saved_searches(id uuid primary key,user_id uuid not null);
create table public.saved_search_matches(id uuid primary key,user_id uuid not null);
create table public.user_marketplace_preferences(user_id uuid primary key);
create table public.marketplace_alert_outbox(listing_id uuid primary key);
create table public.marketplace_postal_centroids(postal_code text primary key);
create table public.transactional_email_deliveries(event_key text primary key);
alter table public.saved_searches enable row level security;
alter table public.saved_search_matches enable row level security;
alter table public.user_marketplace_preferences enable row level security;
alter table public.marketplace_alert_outbox enable row level security;
alter table public.marketplace_postal_centroids enable row level security;
alter table public.transactional_email_deliveries enable row level security;
grant usage on schema public to authenticated,anon;
grant select,insert,update,delete on public.saved_searches,
 public.saved_search_matches,public.user_marketplace_preferences to authenticated;
grant select on public.transactional_email_deliveries to service_role;

create policy saved_search_matches_delete_own on public.saved_search_matches
 for delete to authenticated using ((select auth.uid())=user_id);
create policy saved_search_matches_select_own on public.saved_search_matches
 for select to authenticated using ((select auth.uid())=user_id);
create policy saved_searches_delete_own on public.saved_searches
 for delete to authenticated using ((select auth.uid())=user_id);
create policy saved_searches_insert_own on public.saved_searches
 for insert to authenticated with check ((select auth.uid())=user_id);
create policy saved_searches_select_authorized on public.saved_searches
 for select to authenticated using (((select auth.uid())=user_id) or (select is_superadmin()));
create policy saved_searches_update_own on public.saved_searches
 for update to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
create policy "Users can insert own marketplace preferences" on public.user_marketplace_preferences
 for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users can read own marketplace preferences" on public.user_marketplace_preferences
 for select to authenticated using ((select auth.uid())=user_id);
create policy "Users can update own marketplace preferences" on public.user_marketplace_preferences
 for update to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
create policy transactional_email_deliveries_service_role on public.transactional_email_deliveries
 for all to service_role using (true) with check (true);
