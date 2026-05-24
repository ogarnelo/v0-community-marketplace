-- Security Invoker Demand Views Final Contract Fix v4
-- Supabase is already fixed; this file keeps the fix versioned for contract tests.
-- If your project does not keep Supabase migrations in the Vercel workspace,
-- the test also checks docs/sql.

alter view public.demand_opportunities_30d set (security_invoker = true);

alter view public.demand_activation_opportunities_30d set (security_invoker = true);

alter view public.demand_events_30d_summary set (security_invoker = true);
