-- WETUDY P0: REVIEW-ONLY CANDIDATE, DO NOT EXECUTE ON PRODUCTION.
-- Requires separate explicit DDL authorization, local PostgreSQL17 concurrency test,
-- verified no conflicting school admins and an approved rollback plan.
-- This UNIQUE index is GLOBAL per user, unlike the existing per-school unique index.
-- Never run via prebuild, Vercel, GitHub Actions, or silently via a migration runner.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $gate$
BEGIN
 IF EXISTS (
   SELECT 1 FROM (
     SELECT user_id FROM public.user_roles
     WHERE role = 'school_admin'
     GROUP BY user_id HAVING count(*) > 1
   ) conflicts
 ) THEN RAISE EXCEPTION 'NO_GO_school_admin_multiple_rows'; END IF;
 IF EXISTS (
   SELECT 1 FROM pg_indexes
   WHERE schemaname='public' AND tablename='user_roles'
     AND indexname='user_roles_one_school_admin_per_user_idx'
 ) THEN RAISE EXCEPTION 'NO_GO_school_admin_index_already_present'; END IF;
END $gate$;

CREATE UNIQUE INDEX user_roles_one_school_admin_per_user_idx
 ON public.user_roles (user_id)
 WHERE role = 'school_admin';

DO $postflight$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_index ix
   JOIN pg_class ci ON ci.oid=ix.indexrelid
   WHERE ci.relname='user_roles_one_school_admin_per_user_idx'
     AND ix.indrelid='public.user_roles'::regclass
     AND ix.indisunique AND ix.indisvalid AND ix.indisready
 ) THEN RAISE EXCEPTION 'NO_GO_school_admin_index_not_ready'; END IF;
END $postflight$;

COMMIT;

-- ROLLBACK DESIGN, NEVER AUTOMATIC:
-- DROP INDEX public.user_roles_one_school_admin_per_user_idx;
-- only after independently verifying any grants made under the new invariant.
