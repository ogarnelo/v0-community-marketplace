-- Optimize active MVP RLS policies without changing intended access.
-- Goals:
-- 1) evaluate auth.uid() once per statement via (select auth.uid()),
-- 2) remove duplicate permissive policies that perform the same work,
-- 3) consolidate legitimate OR-access cases into one SELECT policy,
-- 4) remove two truly duplicate indexes/constraints on active tables.

-- Favorites: keep the explicit authenticated CRUD policies and remove the older
-- broad ALL policy.
drop policy if exists "Users can manage their favorites" on public.favorites;

alter policy favorites_select_own on public.favorites
  using ((select auth.uid()) = user_id);

alter policy favorites_insert_own on public.favorites
  with check ((select auth.uid()) = user_id);

alter policy favorites_delete_own on public.favorites
  using ((select auth.uid()) = user_id);

-- The primary key already enforces exactly the same uniqueness.
alter table public.favorites
  drop constraint if exists favorites_user_id_listing_id_key;

-- Conversations.
alter policy "Users can insert own conversations" on public.conversations
  with check (buyer_id = (select auth.uid()));

alter policy "Users can read own conversations" on public.conversations
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

alter policy "Users can update own conversations" on public.conversations
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

-- Hidden conversations.
alter policy hidden_conversations_select_own on public.hidden_conversations
  using ((select auth.uid()) = user_id);

alter policy hidden_conversations_insert_own on public.hidden_conversations
  with check ((select auth.uid()) = user_id);

alter policy hidden_conversations_delete_own on public.hidden_conversations
  using ((select auth.uid()) = user_id);

-- Messages: remove historical duplicate policies and keep the stricter
-- participant-aware set.
drop policy if exists "Users can read their conversations" on public.messages;
drop policy if exists "Users can send messages" on public.messages;
drop policy if exists "Users can insert messages into own conversations" on public.messages;
drop policy if exists "Users can read messages from own conversations" on public.messages;

alter policy messages_select_own_conversations on public.messages
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id = (select auth.uid())
          or c.seller_id = (select auth.uid())
        )
    )
  );

alter policy messages_insert_own_conversations on public.messages
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id = (select auth.uid())
          or c.seller_id = (select auth.uid())
        )
    )
  );

alter policy messages_update_own_conversations on public.messages
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id = (select auth.uid())
          or c.seller_id = (select auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.buyer_id = (select auth.uid())
          or c.seller_id = (select auth.uid())
        )
    )
  );

-- Listing photos.
alter policy listing_photos_insert_owner on public.listing_photos
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_photos.listing_id
        and l.seller_id = (select auth.uid())
    )
  );

alter policy listing_photos_update_owner on public.listing_photos
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_photos.listing_id
        and l.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_photos.listing_id
        and l.seller_id = (select auth.uid())
    )
  );

alter policy listing_photos_delete_owner on public.listing_photos
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_photos.listing_id
        and l.seller_id = (select auth.uid())
    )
  );

-- Listings already have optimized owner policies. One public SELECT policy is
-- enough for authenticated users too.
drop policy if exists "Users can read listings" on public.listings;

-- Notifications.
alter policy notifications_select_own on public.notifications
  using ((select auth.uid()) = user_id);

alter policy notifications_update_own on public.notifications
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Reports: one SELECT policy expresses the intended OR relationship instead of
-- three permissive policies.
drop policy if exists reports_select_own on public.reports;
drop policy if exists reports_select_school_admin on public.reports;
drop policy if exists reports_select_superadmin on public.reports;

create policy reports_select_authorized
on public.reports
for select
to authenticated
using (
  reporter_id = (select auth.uid())
  or public.is_superadmin()
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

alter policy reports_insert_authenticated on public.reports
  with check ((select auth.uid()) = reporter_id);

-- Reviews: collapse duplicate public read and duplicate insert policies, while
-- making insertion explicitly authenticated.
drop policy if exists "Reviews are visible to everyone" on public.reviews;
drop policy if exists "Users can create reviews" on public.reviews;
drop policy if exists "Users can insert reviews" on public.reviews;

create policy reviews_insert_own
on public.reviews
for insert
to authenticated
with check ((select auth.uid()) = reviewer_id);

-- Profiles: one authenticated read policy is enough.
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;

-- Saved searches: remove the older duplicate policy set and consolidate own +
-- superadmin read into one SELECT policy.
drop policy if exists "Users can create own saved searches" on public.saved_searches;
drop policy if exists "Users can read own saved searches" on public.saved_searches;
drop policy if exists "Users can update own saved searches" on public.saved_searches;
drop policy if exists "Users can delete own saved searches" on public.saved_searches;
drop policy if exists saved_searches_select_own on public.saved_searches;
drop policy if exists saved_searches_admin_read on public.saved_searches;

create policy saved_searches_select_authorized
on public.saved_searches
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.is_superadmin()
);

alter policy saved_searches_insert_own on public.saved_searches
  with check ((select auth.uid()) = user_id);

alter policy saved_searches_update_own on public.saved_searches
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy saved_searches_delete_own on public.saved_searches
  using ((select auth.uid()) = user_id);

drop index if exists public.saved_searches_user_id_created_at_idx;

-- User roles: self-read or superadmin-read is one SELECT policy.
drop policy if exists user_roles_select_own on public.user_roles;
drop policy if exists user_roles_select_superadmin on public.user_roles;

create policy user_roles_select_authorized
on public.user_roles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.is_superadmin()
);

-- School access codes: active codes are readable by authenticated users;
-- superadmins can additionally read inactive codes.
drop policy if exists school_access_codes_select_authenticated on public.school_access_codes;
drop policy if exists school_access_codes_select_superadmin on public.school_access_codes;

create policy school_access_codes_select_authorized
on public.school_access_codes
for select
to authenticated
using (
  is_active = true
  or public.is_superadmin()
);

-- Donation request ownership checks.
alter policy "Users can create donation requests" on public.donation_requests
  with check ((select auth.uid()) = requester_id);

alter policy "Users can view own donation requests" on public.donation_requests
  using ((select auth.uid()) = requester_id);

-- Demand-match notifications: own rows or superadmin, expressed once.
drop policy if exists "Users can read own demand match notifications" on public.demand_match_notifications;
drop policy if exists "Super admins can read demand match notifications" on public.demand_match_notifications;

create policy demand_match_notifications_select_authorized
on public.demand_match_notifications
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.is_superadmin()
);
