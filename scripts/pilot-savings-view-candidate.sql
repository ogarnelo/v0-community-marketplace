-- WETUDY · CANDIDATE ONLY — DO NOT EXECUTE ON HOSTED SUPABASE.
-- A secure, low-storage path to globally sort estimated savings in future.
-- This is NOT a deployed migration; reviewing security and query cost is
-- required before adding a versioned migration and switching the APIs.
--
-- "Ahorro" is a subjective estimate based on seller-supplied reference price:
-- COALESCE(original_price, estimated_retail_price, 0) minus sale price.
-- Negative differences are clamped to zero; free donations can have savings.
-- "Mayor ahorro" therefore ranks estimates, NOT verified retail prices.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

CREATE OR REPLACE VIEW public.marketplace_listings_sortable
WITH (security_invoker = true)
AS SELECT
  l.id, l.title, l.description, l.category, l.grade_level,
  l.condition, l.type, l.listing_type, l.isbn, l.author,
  l.publisher, l.format, l.language, l.subject, l.specific_type,
  l.size_label, l.brand, l.model, l.season,
  l.price, l.original_price, l.estimated_retail_price,
  l.seller_id, l.user_id, l.school_id, l.directory_school_code,
  l.postal_code, l.status, l.created_at,
  GREATEST(
    COALESCE(l.original_price, l.estimated_retail_price, 0)
      - COALESCE(l.price, 0),
    0
  )::numeric AS estimated_savings
FROM public.listings l;

-- Keep explicit limited grants: underlying SELECT privilege and RLS
-- remain enforced due to security_invoker=true.
REVOKE ALL ON public.marketplace_listings_sortable FROM PUBLIC;
GRANT SELECT ON public.marketplace_listings_sortable TO anon, authenticated;
COMMIT;
