-- REVIEW-ONLY PROPOSAL; NEVER execute on production before the code migration is merged and tested.
-- Existing exposed public.listings grants allow anon full 36-column SELECT, including postal_code/lat/lng.
-- The two public marketplace listing readers are migrated in this change to server-only service_role
-- with an explicit status='available' predicate. Other public/consumer paths need review.
-- Revoke ALL direct SELECT for anon, not only a few columns, so new columns cannot leak.
-- Do not change authenticated permissions or existing policies in this pilot-only proposal.
BEGIN;
REVOKE SELECT ON TABLE public.listings FROM anon;
-- No new SELECT grants to anon.
-- Gate postconditions in the approved release window:
DO $$
BEGIN
  IF has_table_privilege('anon','public.listings','SELECT')
     OR has_column_privilege('anon','public.listings','postal_code','SELECT')
     OR has_column_privilege('anon','public.listings','lat','SELECT')
     OR has_column_privilege('anon','public.listings','lng','SELECT')
     OR has_column_privilege('anon','public.listings','seller_id','SELECT')
     OR has_column_privilege('anon','public.listings','user_id','SELECT') THEN
    RAISE EXCEPTION 'NO_GO: anonymous listing exposure remains';
  END IF;
  IF NOT has_table_privilege('authenticated','public.listings','SELECT')
     OR NOT has_table_privilege('service_role','public.listings','SELECT') THEN
    RAISE EXCEPTION 'NO_GO: authenticated/service access was altered';
  END IF;
END $$;
COMMIT;
-- If an unknown public consumer breaks, roll back only via a reviewed GRANT SELECT after
-- understanding exposure: reinstating broad anonymous SELECT reopens all 36 columns.
