-- REVIEW ONLY. Requires SPECIFIC approval before Supabase WETUDY jpsljmakoscqevssimtk DDL.
-- VM Copilot is out of scope. No historic selling_intent implies permission.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $$
BEGIN
 IF to_regclass('public.user_marketplace_preferences') IS NULL OR
    to_regclass('public.demand_opportunity_actions') IS NULL THEN
  RAISE EXCEPTION 'PR816 missing required table';
 END IF;
 IF EXISTS (SELECT 1 FROM public.demand_opportunity_actions
  WHERE action_type='seller_contacted' AND target_user_id IS NOT NULL
  GROUP BY opportunity_key,target_user_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'PR816 duplicate historical action, review before unique index';
 END IF;
END $$;
ALTER TABLE public.user_marketplace_preferences ADD COLUMN IF NOT EXISTS
 supply_outreach_opt_in boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS demand_outreach_recipient_once_idx
 ON public.demand_opportunity_actions(opportunity_key,target_user_id)
 WHERE action_type='seller_contacted' AND target_user_id IS NOT NULL;
COMMIT;
-- Rollback requires further explicit approval. Remove index and column only
-- AFTER code no longer depends on them, preserving RLS and all existing data.
