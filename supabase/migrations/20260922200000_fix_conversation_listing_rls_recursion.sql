-- Break the RLS recursion between listings and conversations without widening access.
-- The helper only answers whether the *current authenticated user* participates
-- in a conversation for the given listing.

create or replace function public.is_current_user_listing_participant(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.listing_id = p_listing_id
      and (
        c.buyer_id = (select auth.uid())
        or c.seller_id = (select auth.uid())
      )
  );
$$;

revoke all on function public.is_current_user_listing_participant(uuid) from public;
grant execute on function public.is_current_user_listing_participant(uuid) to authenticated;

drop policy if exists listings_select_owner_or_participant on public.listings;

create policy listings_select_owner_or_participant
on public.listings
for select
to authenticated
using (
  (select auth.uid()) = seller_id
  or public.is_current_user_listing_participant(id)
);
