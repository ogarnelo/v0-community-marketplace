-- WETUDY #787 — catalog-only dependency snapshot for proposed anon SELECT review.
-- Read-only metadata; NO table rows, NO grants/revocations, NO mutations.
-- Run manually only against the explicitly selected project; do not use as migration.
BEGIN TRANSACTION READ ONLY;

-- Effective privileges, RLS and anonymous policy drift.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select,
       has_table_privilege('service_role', c.oid, 'SELECT') AS service_select,
       count(*) FILTER (
         WHERE p.cmd IN ('SELECT', 'ALL')
           AND ('anon' = ANY(p.roles) OR 'public' = ANY(p.roles))
       ) AS guest_select_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN ('agreements', 'demand_requests', 'profiles',
                    'saved_searches', 'schools')
GROUP BY c.oid, c.relname, c.relrowsecurity
ORDER BY c.relname;

-- Publications and replica identity: a table-level revoke must not disrupt
-- authenticated subscriptions. Membership is not evidence of actual clients.
SELECT pt.pubname, pt.schemaname, pt.tablename, c.relreplident,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select
FROM pg_publication_tables pt
JOIN pg_namespace n ON n.nspname = pt.schemaname
JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = pt.tablename
WHERE pt.schemaname = 'public'
  AND pt.tablename IN ('agreements', 'demand_requests', 'profiles',
                        'saved_searches', 'schools')
ORDER BY pt.pubname, pt.tablename;

-- Direct dependency graph for views; does NOT cover external consumers.
WITH target AS (
  SELECT c.oid, c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND
    c.relname IN ('agreements', 'demand_requests', 'profiles',
                  'saved_searches', 'schools')
)
SELECT DISTINCT t.relname AS source_table, ns.nspname AS view_schema,
       v.relname AS view_name,
       has_table_privilege('anon', v.oid, 'SELECT') AS anon_view_select,
       coalesce('security_invoker=true' = ANY(v.reloptions), false) AS security_invoker
FROM target t
JOIN pg_depend d ON d.refobjid = t.oid AND d.refclassid = 'pg_class'::regclass
JOIN pg_rewrite w ON w.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
JOIN pg_class v ON v.oid = w.ev_class
JOIN pg_namespace ns ON ns.oid = v.relnamespace
WHERE v.relkind IN ('v', 'm')
ORDER BY source_table, view_schema, view_name;

-- Function-body textual references are HEURISTIC, not a complete dependency
-- graph for dynamic SQL, compiled dependencies, SECURITY DEFINER or RPC routes.
-- Return names/permissions only, never bodies, credentials or user rows.
SELECT ns.nspname AS function_schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
WHERE ns.nspname IN ('public', 'private')
  AND p.prosrc ~* '(agreements|demand_requests|profiles|saved_searches|schools)'
ORDER BY ns.nspname, p.proname, arguments;

COMMIT;
