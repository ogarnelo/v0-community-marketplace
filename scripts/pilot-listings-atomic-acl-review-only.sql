-- WETUDY P0 ATOMIC ACL PROPOSAL -- REVIEW ONLY, NEVER execute on production
-- without explicit founder authorization, verified DR and fully deployed readers.
-- Resolves contradictory postconditions in the two older standalone proposals.
-- PostgreSQL transactional DDL/GRANT: on exception, every grant change rolls back.
BEGIN;
DO $preflight$
DECLARE column_count int;
BEGIN
  SELECT count(*) INTO column_count FROM pg_attribute
  WHERE attrelid='public.listings'::regclass AND attnum>0 AND NOT attisdropped;
  IF NOT (SELECT relrowsecurity FROM pg_class
    WHERE oid='public.listings'::regclass) THEN
    RAISE EXCEPTION 'NO_GO_ATOMIC_ACL: row level security must already be enabled';
  END IF;
  -- A table-level REVOKE does not revoke per-column privileges. Fail before
  -- any ACL mutation if an anonymous/PUBLIC column grant exists.
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    CROSS JOIN LATERAL aclexplode(a.attacl) acl
    WHERE a.attrelid='public.listings'::regclass
      AND a.attnum>0 AND NOT a.attisdropped
      AND acl.grantee IN (0,(SELECT oid FROM pg_roles WHERE rolname='anon'))
      AND acl.privilege_type IN ('SELECT','INSERT','UPDATE')
  ) THEN
    RAISE EXCEPTION 'NO_GO_ATOMIC_ACL: unexpected direct anon/public column grant';
  END IF;
  IF column_count<>36 THEN
    RAISE EXCEPTION 'NO_GO_ATOMIC_ACL: unexpected listings schema (% columns)',column_count;
  END IF;
  IF NOT has_table_privilege('anon','public.listings','SELECT')
     OR NOT has_table_privilege('authenticated','public.listings','SELECT')
     OR NOT has_table_privilege('service_role','public.listings','SELECT')
     OR NOT has_table_privilege('authenticated','public.listings','INSERT')
     OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
     OR NOT has_table_privilege('authenticated','public.listings','DELETE') THEN
    RAISE EXCEPTION 'NO_GO_ATOMIC_ACL: baseline changed since reviewed';
  END IF;
END
$preflight$;

REVOKE SELECT ON TABLE public.listings FROM anon,authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.listings FROM anon;
GRANT SELECT (
  id,school_id,user_id,title,description,category,grade_level,condition,
  listing_type,price,estimated_retail_price,status,isbn,author,publisher,
  format,language,created_at,updated_at,seller_id,type,original_price,
  photos,subject,specific_type,size_label,brand,model,season,
  book_edition_id,directory_school_code,is_demo,savings_amount
) ON TABLE public.listings TO authenticated;

DO $postflight$
DECLARE read_count int;
BEGIN
  SELECT count(*) INTO read_count
  FROM pg_attribute a
  WHERE a.attrelid='public.listings'::regclass AND a.attnum>0
    AND NOT a.attisdropped
    AND has_column_privilege('authenticated','public.listings',a.attname,'SELECT');
  IF read_count<>33
     OR has_table_privilege('anon','public.listings','SELECT')
     OR has_table_privilege('authenticated','public.listings','SELECT')
     OR has_any_column_privilege('anon','public.listings','SELECT')
     OR has_table_privilege('anon','public.listings','INSERT')
     OR has_table_privilege('anon','public.listings','UPDATE')
     OR has_table_privilege('anon','public.listings','DELETE')
     OR has_any_column_privilege('anon','public.listings','INSERT')
     OR has_any_column_privilege('anon','public.listings','UPDATE')
     OR has_column_privilege('authenticated','public.listings','postal_code','SELECT')
     OR has_column_privilege('authenticated','public.listings','lat','SELECT')
     OR has_column_privilege('authenticated','public.listings','lng','SELECT')
     OR NOT has_table_privilege('authenticated','public.listings','INSERT')
     OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
     OR NOT has_table_privilege('authenticated','public.listings','DELETE')
     OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
     OR NOT has_table_privilege('service_role','public.listings','SELECT') THEN
    RAISE EXCEPTION 'NO_GO_ATOMIC_ACL: access contract not satisfied, rollback required';
  END IF;
END
$postflight$;
COMMIT;
-- This proposal is NOT a deployable migration. All client/API/photo and
-- recovery checks must pass before approval. Public photo RLS depending on
-- listings may reject anonymous direct photo reads: SSR service-side readers
-- must be independently verified during the approved release window.
