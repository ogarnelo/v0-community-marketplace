-- Public marketplace rows must expose only currently available listings.
-- Owners and conversation participants retain access to historical rows so
-- account history, chat and future payment/shipping flows can keep their context.
drop policy if exists "Anyone can read listings" on public.listings;
drop policy if exists listings_select_available_public on public.listings;
drop policy if exists listings_select_owner_or_participant on public.listings;

create policy listings_select_available_public
on public.listings
for select
to public
using (status = 'available');

create policy listings_select_owner_or_participant
on public.listings
for select
to authenticated
using (
  (select auth.uid()) = seller_id
  or exists (
    select 1
    from public.conversations c
    where c.listing_id = listings.id
      and (
        c.buyer_id = (select auth.uid())
        or c.seller_id = (select auth.uid())
      )
  )
);
