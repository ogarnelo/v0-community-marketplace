-- Keep the RLS helper out of the exposed public API schema.
create schema if not exists private;

create or replace function private.is_current_user_listing_participant(p_listing_id uuid)
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

revoke all on function private.is_current_user_listing_participant(uuid) from public;
revoke all on function private.is_current_user_listing_participant(uuid) from anon;
grant execute on function private.is_current_user_listing_participant(uuid) to authenticated, service_role;

drop policy if exists listings_select_owner_or_participant on public.listings;

create policy listings_select_owner_or_participant
on public.listings
for select
to authenticated
using (
  (select auth.uid()) = seller_id
  or private.is_current_user_listing_participant(id)
);

drop function if exists public.is_current_user_listing_participant(uuid);
