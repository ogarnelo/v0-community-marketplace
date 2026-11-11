-- WETUDY pilot: function entrypoint audit against table-wide privileges.
-- Metadata only; never displays function source or user rows.
-- Scan public functions and function-level privileges effective for client roles.
BEGIN TRANSACTION READ ONLY;

WITH funcs AS (
  SELECT p.oid,p.proname,p.prosecdef,p.prosrc
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
)
SELECT count(*)::int AS public_functions,
       count(*) FILTER (WHERE prosecdef)::int AS security_definer,
       count(*) FILTER (WHERE prosecdef
         AND has_function_privilege('anon',oid,'EXECUTE'))::int
         AS definer_executable_by_anon,
       count(*) FILTER (WHERE prosecdef
         AND has_function_privilege('authenticated',oid,'EXECUTE'))::int
         AS definer_executable_by_authenticated,
       count(*) FILTER (WHERE prosecdef AND position('execute' in lower(prosrc))>0)::int
         AS definer_with_dynamic_sql_token,
       count(*) FILTER (WHERE position('truncate' in lower(prosrc))>0)::int
         AS function_sources_mentioning_truncate,
       count(*) FILTER (WHERE position('set role' in lower(prosrc))>0)::int
         AS function_sources_mentioning_set_role
FROM funcs;

DO $wetudy$
DECLARE
  exposed integer;
  suspicious integer;
BEGIN
  SELECT count(*)::int INTO exposed
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
    AND (has_function_privilege('anon',p.oid,'EXECUTE')
      OR has_function_privilege('authenticated',p.oid,'EXECUTE'));
  IF exposed > 0 THEN
    RAISE EXCEPTION 'P0: % SECURITY DEFINER public functions executable by client roles',exposed;
  END IF;
  -- SQL keyword checks are heuristic, not a full parser or exploit test.
  SELECT count(*)::int INTO suspicious
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
    AND (position('truncate' in lower(p.prosrc))>0
      OR position('set role' in lower(p.prosrc))>0);
  IF suspicious > 0 THEN
    RAISE EXCEPTION 'P0: % public function definitions mention TRUNCATE or SET ROLE; manual review required',suspicious;
  END IF;
  RAISE NOTICE 'PASS: No direct anon/authenticated EXECUTE on SECURITY DEFINER public functions; no literal TRUNCATE/SET ROLE';
END $wetudy$;

COMMIT;
SELECT 'PASS: function entrypoints audited via metadata, no family rows' AS status;
