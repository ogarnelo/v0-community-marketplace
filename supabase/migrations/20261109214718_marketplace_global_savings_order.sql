-- Fast, deterministic global sorting for "Mayor ahorro".
-- Generated amount matches the existing listing-card estimated savings:
-- original_price (or estimated_retail_price) minus asking price.
-- No customer/profile data is changed; existing listings are not deleted.
alter table public.listings
  add column if not exists savings_amount numeric generated always as
    (coalesce(original_price, estimated_retail_price, 0) - coalesce(price, 0)) stored;

-- Partial index only for listings visible on the marketplace. Stable tie-break.
create index if not exists listings_available_savings_order_idx
  on public.listings (savings_amount desc, created_at desc, id desc)
  where status = 'available';

-- Supabase PostgREST reloads schema metadata to recognize the new sort column.
notify pgrst, 'reload schema';
