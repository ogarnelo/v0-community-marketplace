-- Optimize active MVP/admin RLS predicates so auth helpers are evaluated once
-- per statement instead of once per row. This is a planner-only hardening pass;
-- authorization semantics remain unchanged.

alter policy marketplace_search_events_admin_read
on public.marketplace_search_events
using ((select public.is_superadmin()));

alter policy listing_views_select_superadmin
on public.listing_views
using ((select public.is_superadmin()));

alter policy support_tickets_select_superadmin
on public.support_tickets
using ((select public.is_superadmin()));

alter policy support_tickets_update_superadmin
on public.support_tickets
using ((select public.is_superadmin()))
with check ((select public.is_superadmin()));

alter policy school_registration_requests_select_superadmin
on public.school_registration_requests
using ((select public.is_superadmin()));

alter policy school_registration_requests_update_superadmin
on public.school_registration_requests
using ((select public.is_superadmin()))
with check ((select public.is_superadmin()));

alter policy school_access_codes_insert_superadmin
on public.school_access_codes
with check ((select public.is_superadmin()));

alter policy school_access_codes_select_authorized
on public.school_access_codes
using ((is_active = true) or (select public.is_superadmin()));

alter policy saved_searches_select_authorized
on public.saved_searches
using (((select auth.uid()) = user_id) or (select public.is_superadmin()));

alter policy demand_match_notifications_select_authorized
on public.demand_match_notifications
using (((select auth.uid()) = user_id) or (select public.is_superadmin()));

alter policy reports_select_authorized
on public.reports
using (
  reporter_id = (select auth.uid())
  or (select public.is_superadmin())
  or (
    target_type = 'listing'
    and exists (
      select 1
      from public.listings l
      join public.user_roles ur on ur.school_id = l.school_id
      where l.id = reports.listing_id
        and ur.user_id = (select auth.uid())
        and ur.role = 'school_admin'
    )
  )
);

alter policy reports_update_superadmin
on public.reports
using ((select public.is_superadmin()))
with check ((select public.is_superadmin()));

alter policy user_roles_delete_superadmin
on public.user_roles
using ((select public.is_superadmin()));

alter policy user_roles_insert_superadmin
on public.user_roles
with check ((select public.is_superadmin()));

alter policy user_roles_select_authorized
on public.user_roles
using (((select auth.uid()) = user_id) or (select public.is_superadmin()));

alter policy user_roles_update_superadmin
on public.user_roles
using ((select public.is_superadmin()))
with check ((select public.is_superadmin()));

alter policy "Users can insert their reviews"
on public.transaction_reviews
with check ((select auth.uid()) = reviewer_id);

alter policy "Users can insert own events"
on public.marketplace_events
with check (((select auth.uid()) = user_id) or (user_id is null));

alter policy "Users can read own events"
on public.marketplace_events
using ((select auth.uid()) = user_id);

alter policy "Users can insert own marketplace preferences"
on public.user_marketplace_preferences
with check ((select auth.uid()) = user_id);

alter policy "Users can read own marketplace preferences"
on public.user_marketplace_preferences
using ((select auth.uid()) = user_id);

alter policy "Users can update own marketplace preferences"
on public.user_marketplace_preferences
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
