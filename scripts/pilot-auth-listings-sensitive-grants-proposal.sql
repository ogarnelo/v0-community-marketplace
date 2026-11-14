-- REVIEW-ONLY PILOT PROPOSAL: do NOT apply to production until ALL list readers are audited.
-- The authenticated role currently can SELECT ALL 36 listing columns despite RLS.
-- This restricts only the three sensitive location columns while retaining all
-- other SELECT fields needed by account pages, filters, favorites and messaging.
-- The school feed is migrated to the server-only admin client in PR #438.
-- Run as part of ONE approved transaction after verifying schema/ACL baselines.
REVOKE SELECT ON TABLE public.listings FROM authenticated;
GRANT SELECT (id, school_id, user_id, title, description, category, grade_level, condition, listing_type, price, estimated_retail_price, status, isbn, author, publisher, format, language, created_at, updated_at, seller_id, type, original_price, photos, subject, specific_type, size_label, brand, model, season, book_edition_id, directory_school_code, is_demo, savings_amount)
  ON TABLE public.listings TO authenticated;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.listings','SELECT')
    OR has_column_privilege('authenticated','public.listings','postal_code','SELECT')
    OR has_column_privilege('authenticated','public.listings','lat','SELECT')
    OR has_column_privilege('authenticated','public.listings','lng','SELECT')
  THEN RAISE EXCEPTION 'NO_GO: authenticated can still select private listing location'; END IF;
  IF NOT has_column_privilege('authenticated','public.listings','id','SELECT')
     OR NOT has_column_privilege('authenticated','public.listings','seller_id','SELECT')
     OR NOT has_column_privilege('authenticated','public.listings','status','SELECT')
     OR NOT has_column_privilege('authenticated','public.listings','is_demo','SELECT')
  THEN RAISE EXCEPTION 'NO_GO: authenticated public listing essentials revoked'; END IF;
  IF NOT has_table_privilege('service_role','public.listings','SELECT')
  THEN RAISE EXCEPTION 'NO_GO: server listing reads revoked'; END IF;
END $$;
-- No RLS policy changes, no DELETE/INSERT/UPDATE privilege changes. Exact new
-- columns must be deliberately allowed; avoid auto-granting future fields.
