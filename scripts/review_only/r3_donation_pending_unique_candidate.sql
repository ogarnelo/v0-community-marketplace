-- WETUDY R3 / A-015 — CANDIDATE SQL ONLY / REVIEW ONLY / NOT INSTALLED
-- DO NOT APPLY IN SUPABASE WETUDY OR ANY PRODUCTION SYSTEM WITHOUT A NEW
-- EXPLICIT OWNER AUTHORIZATION, PREFLIGHT, REVIEW AND APPROVED ROLLBACK.
-- This file is OUTSIDE supabase/migrations: CI uses only a disposable PG17 DB.
-- Scope: at most one pending request per (listing, requester).
-- Does NOT change donor school scope, RLS, grants, approved winner index,
-- requests from different users, or the seller/admin assignment protocol.
-- PostgreSQL index creation takes a write lock. Schedule any authorized DDL.
BEGIN;

DO $preflight$
DECLARE
  duplicate_groups bigint;
BEGIN
  IF to_regclass('public.donation_requests') IS NULL THEN
    RAISE EXCEPTION 'NO_GO_R3_A015_MISSING_TABLE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='donation_requests'
      AND c.relkind IN ('r','p') AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'NO_GO_R3_A015_RLS_NOT_ENABLED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='donation_requests_one_pending_per_requester_listing_idx'
  ) THEN
    RAISE EXCEPTION 'NO_GO_R3_A015_INDEX_ALREADY_EXISTS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class ic ON ic.oid=i.indexrelid
    JOIN pg_namespace n ON n.oid=ic.relnamespace
    WHERE n.nspname='public'
      AND ic.relname='donation_requests_one_approved_per_listing_idx'
      AND i.indisunique AND i.indisvalid AND i.indisready
  ) THEN
    RAISE EXCEPTION 'NO_GO_R3_A015_EXISTING_WINNER_GUARD_DRIFTED';
  END IF;
  SELECT COUNT(*) INTO duplicate_groups
  FROM (
    SELECT listing_id, requester_id FROM public.donation_requests
    WHERE status='pending'
      AND listing_id IS NOT NULL AND requester_id IS NOT NULL
    GROUP BY listing_id, requester_id
    HAVING COUNT(*) > 1
  ) d;
  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION 'NO_GO_R3_A015_DUPLICATE_PENDING_GROUPS %', duplicate_groups;
  END IF;
END $preflight$;

CREATE UNIQUE INDEX donation_requests_one_pending_per_requester_listing_idx
  ON public.donation_requests (listing_id, requester_id)
  WHERE status='pending'
    AND listing_id IS NOT NULL AND requester_id IS NOT NULL;

DO $postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class ic ON ic.oid=i.indexrelid
    JOIN pg_namespace n ON n.oid=ic.relnamespace
    WHERE n.nspname='public'
      AND ic.relname='donation_requests_one_pending_per_requester_listing_idx'
      AND i.indisunique AND i.indisvalid AND i.indisready
      AND pg_get_indexdef(i.indexrelid) ILIKE '%(listing_id, requester_id)%'
      AND pg_get_expr(i.indpred,i.indrelid) ILIKE '%pending%'
  ) THEN
    RAISE EXCEPTION 'NO_GO_R3_A015_INDEX_POSTFLIGHT_FAILED';
  END IF;
END $postflight$;

COMMIT;

-- Future production rollback ONLY if independently approved:
-- identify the index by exact schema/name/definition and original ACL+RLS
-- snapshot; if rollback is needed, DROP INDEX public.
-- donation_requests_one_pending_per_requester_listing_idx after explicit
-- authorization and postflight. Never rollback the older approved index.
