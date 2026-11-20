# WETUDY · #438 selective anonymous-SELECT review (20 November 2026)

## Scope / explicit NO-GO

This change does **not** alter production DB grants, RLS, Storage, authorization paths, flags, or Supabase migration history. It does not merge the historical draft PR #438. Piloto general remains NO-GO. The SQL proposal is intentionally under scripts/ (NOT supabase/migrations/) and aborts outside a specifically named disposable local PG17 database.

## Read-only source evidence

On Supabase project Education Marketplace, PostgreSQL 17 catalog metadata-only SELECT queries confirmed:

| public relation | anon SELECT effective | Direct anon SELECT | RLS | SELECT policy for anon/PUBLIC |
|---|---|---|---|---|
| agreements | yes | yes | ON | none |
| demand_requests | yes | yes | ON | none |
| profiles | yes | yes | ON | none |
| saved_searches | yes | yes | ON | none |
| schools | yes | yes | ON | none |
| listings | no | no | ON | PUBLIC available-only policy exists, but anon has no table grant |
| school_directory | no | no | ON | none |

All five intended targets preserve authenticated and service_role direct SELECT grants. The catalog queries also found no extra role memberships for anon. This is **not** a proof about every API/RPC/view or about end-to-end HTTP behavior; RLS still needs to be audited if policies change. A harmless-looking grant can become dangerous following later policy drift.

## Files and tests

- scripts/pilot-anon-select-wave1-local-only.sql: disposable-database guard; RLS/policy preflight; five explicit REVOKE SELECT; postflight requiring no effective table or column SELECT for anon, while authenticated and service_role retain SELECT. It also rejects SELECT inherited through PUBLIC or residual column ACLs rather than pretending the revoke succeeded.
- scripts/pilot-anon-select-wave1-pg17.py: PostgreSQL 17 disposable local DB, synthetic ownership/RLS, five role grants, two non-target controls, idempotence, re-grant recovery, rollback on PUBLIC and column privilege drift, and unexpected anonymous RLS policy denial. No real-family fixtures.
- __tests__/launch/pilot-anon-select-wave1-review-only.test.mjs: static contract, Python parse, CI coupling, and no remote DB configuration.
- .github/workflows/contracts.yml: required critical-contracts job executes static contract.
- .github/workflows/pilot-synthetic-db-storage-recovery.yml: PR-triggered isolated PostgreSQL 17 execution with loopback-only URL; never pointed to Supabase.

## Hold points before ANY future production change

1. Finish a separate inventory of actual anonymous callers, SSR, browser, Data API and RPC/SECURITY DEFINER dependencies, views, Realtime and column ACLs. Static source checks are insufficient.
2. Verify signed-in owner, admin, and public read paths against an isolated PostgREST and representative synthetic schema and explicit failure/rollback. This PG17 fixture tests privilege mechanics, **not** complete Supabase or browser integration.
3. Create a separate, independently reviewed production migration only after risk and compatibility checks; confirm current grants, RLS and client versions again immediately before rollout. Require explicit permission for grant changes.
4. Preserve the ability to restore the exact recorded grants on rollback, and verify real postflight. Do not activate the pilot for this.

Reference: issue #767 and historical draft PR #438.