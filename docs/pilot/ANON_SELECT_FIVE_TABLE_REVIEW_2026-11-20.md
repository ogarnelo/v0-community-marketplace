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

## Dependent views and caveats (metadata-only production check)

A read-only pg_rewrite/pg_depend query identifies two views depending on the five target tables:

| View | Depends on | Direct/effective anon SELECT | security_invoker |
|---|---|---|---|
| public.demand_opportunities_30d | public.demand_requests | yes | true |
| public.saved_search_demand_summary | public.saved_searches | no | true |

GitHub code search in modern main found **no references** to demand_opportunities_30d and five references to saved_search_demand_summary (migrations, docs, and tests). Absence of code references does **not** rule out external clients, stored procedures, or RPC. An anonymous query to an invoker view may start returning a permission error after the underlying grant is revoked; the synthetic HTTP harness explicitly covers this behavior. Do not silently remove the view grant as part of the five-table proposal. Static function dependency query returned no pg_proc dependencies; dynamic SQL/PLpgSQL dependencies are not exhaustively captured that way.

## RPC and Realtime dependency audit (catalog-only production evidence)

- Read-only query of `pg_publication_tables`: among the five target tables, **only `public.agreements`** is a member of `supabase_realtime` (replica identity `d`, RLS ON). The others are not currently in this publication.
- `components/agreements/agreement-panel.tsx` creates a browser `postgres_changes` subscription filtered by `conversation_id`; code search found one render site, `app/messages/[id]/page.tsx`, where `getCurrentUser()` precedes a redirect for missing users and the agreement component render. This protects the inspected route but does NOT prove actual Realtime delivery or external subscriber absence.
- A metadata-only `pg_proc.prosrc` textual scan found **20 public/private functions mentioning at least one target**; **9 SECURITY DEFINER**. Of these, **0 are executable by `anon` and 0 by `authenticated` according to `has_function_privilege`**; 19 are executable by `service_role`. The remaining function is not service-executable. Textual body matching can miss dynamic SQL and dependencies in nested calls; **not a complete RPC security proof**. No function was executed.
- The SQL inventory in `scripts/pilot-anon-select-dependencies-readonly.sql` is a repeatable metadata-only snapshot; it must not be used to read personal rows, execute functions or make permission changes.
- The disposable PostgreSQL 17 test creates a synthetic publication for agreements and verifies membership and authenticated SELECT survive the proposed revoke. In addition, the **real Realtime WebSocket subblock has been completed**: a disposable PostgreSQL 17 logical-WAL fixture with Supabase Realtime server and real signed JS clients delivered agreement UPDATE messages only to buyer/seller before and after the proposal, not to outsider or guest. CI evidence: https://github.com/ogarnelo/v0-community-marketplace/actions/runs/44804789909 . This still does **not** prove full browser/app or production Realtime equivalence.

## First-party reader census and external traffic — current hold point

The new offline AST inventory (captured from a passing GitHub Actions job on this PR) records **72 first-party source files**, **112 file/table pairs**, **178 literal Supabase table calls** targeting the five relations: agreements 16, demand_requests 24, profiles 67, saved_searches 30, schools 41. These include updates/upserts, not only reads. Direct literal `/rest/v1/<table>` references are also checked. This is a source-code census, **not** a claim that all 178 calls have passed auth/RLS E2E.

The AST scan excludes `Array.from` and Supabase Storage's `storage.from(bucket)`. One nonliteral database table lookup remains: `admin.from(table)` inside `app/api/listings/delete/route.ts`, where a static retention-table list contains `agreements`; the handler requires authenticated listing ownership before making this server-admin query. The source snapshot is locked at `docs/pilot/ANON_FIVE_TABLE_SOURCE_READER_BASELINE.json` and CI runs `--check`, rejecting new or changed source references until reviewed. New raw SQL, RPC dependencies, clients outside this repository, and nonliteral direct REST routes remain possible blind spots.

A real-handler in-memory guest fixture exercises `GET /api/schools/public` and `GET /api/marketplace/feed` with **all five anonymous table reads treated as forbidden**; the minimal public school response, general marketplace feed, and guest distance denial still behave as expected. Existing code guards require verified users for profile and saved-search client reads. **This is code-path compatibility, not live Next.js/Supabase full-stack E2E.**

Read-only **aggregated Supabase edge request logs** were consulted without any raw paths, IPs, tokens, user IDs or request bodies. For each window in UTC, only requests to the five named `/rest/v1/<table>` relations were counted:

| UTC window | Observed target REST requests (method/relation) | Reported credential classification |
|---|---|---|
| 17 Nov 00:00–18 Nov 00:00 | 9 GET profiles | 9 secret-key |
| 18 Nov 00:00–19 Nov 00:00 | 2 GET profiles | 2 secret-key |
| 19 Nov 00:00–20 Nov 00:00 | 5 GET agreements; 8 HEAD agreements; 1 GET demand_requests; 96 GET profiles; 1 GET saved_searches; 5 GET schools | GET agreements 5 secret-key; HEAD agreements 8 authenticated JWT; demand_requests 1 secret-key; profiles 52 secret-key + 44 authenticated JWT; saved_searches 1 secret-key; schools 5 authenticated JWT |
| Rolling last 24h queried on 20 Nov | 7 GET profiles | 7 secret-key, 0 publishable-key |

For these windows there was **no logged `anon` JWT role among the matched requests**, but key-classification fields are not present for every logging/auth mode. Observed traffic is not proof that outside clients, obsolete apps, scheduled integrations or guest direct reads do not exist on another day or without classified role metadata. Never use the absence of a logged guest request as authorization for a production permission change. No live permission mutation occurred in this audit.

**Gate stays OPEN**: independently identify/attest external Data API consumers, review API request/client telemetry beyond the sampled days where available, and run representative authenticated and anonymous application/browser coverage. Do not merge #787 or revoke production anon SELECT based solely on this census.

## Files and tests

- scripts/pilot-anon-select-wave1-local-only.sql: disposable-database guard; RLS/policy preflight; five explicit REVOKE SELECT; postflight requiring no effective table or column SELECT for anon, while authenticated and service_role retain SELECT. It also rejects SELECT inherited through PUBLIC or residual column ACLs rather than pretending the revoke succeeded.
- scripts/pilot-anon-select-wave1-pg17.py: PostgreSQL 17 disposable local DB, synthetic ownership/RLS, five role grants, two non-target controls, idempotence, re-grant recovery, rollback on PUBLIC and column privilege drift, and unexpected anonymous RLS policy denial. No real-family fixtures.
- __tests__/launch/pilot-anon-select-wave1-review-only.test.mjs: static contract, Python parse, CI coupling, and no remote DB configuration.
- scripts/pilot-anon-select-dependencies-readonly.sql: four SQL metadata-only statements for grants/RLS, publication membership, view dependencies and heuristic RPC permissions; enclosed in BEGIN TRANSACTION READ ONLY and COMMIT.
- __tests__/launch/pilot-anon-select-dependencies-review-only.test.mjs: required static critical contract for the read-only inventory, authenticated subscription source path and isolated publication regression.
- scripts/pilot-anon-select-postgrest-pg17.py: starts official version-tagged PostgREST Docker container on the GitHub runner's loopback interface, backed only by a disposable PostgreSQL17 database; checks the five table endpoints and an invoker-view dependency before and after REVOKE using anonymous HTTP and signed synthetic authenticated JWTs for two distinct owners. No live Supabase endpoint or real credentials are used.
- __tests__/launch/pilot-anon-select-postgrest-local-only.test.mjs: contracts ensuring the HTTP test is loopback-only, synthetically authenticated, and executed by the isolated PG17 workflow.
- .github/workflows/contracts.yml: required critical-contracts job executes static contract.
- .github/workflows/pilot-synthetic-db-storage-recovery.yml: PR-triggered isolated PostgreSQL 17 execution and HTTP PostgREST probe with loopback-only URLs; never pointed to Supabase. Docker image `postgrest/postgrest:v14.18` is a tool for testing PostgREST permission enforcement, not a statement about the live Supabase API version.

## Hold points before ANY future production change

1. Finish a separate inventory of actual anonymous callers, SSR, browser, Data API, external clients, RPC/SECURITY DEFINER dependencies, views, Realtime and column ACLs. Current code search/catalog findings are useful but static checks are insufficient, and the invoker view may change its guest error behavior.
2. Run application-level browser and authenticated admin/family paths, including agreement Realtime delivery after revoke, against an isolated representative Supabase stack (or authorized pilot QA); the local PostgREST HTTP smoke validates permission enforcement and simulated owner isolation, but **does not** reproduce every live Supabase schema, JWT/RLS function, RPC, Storage, Realtime or Next.js end-to-end behavior.
3. Create a separate, independently reviewed production migration only after risk and compatibility checks; confirm current grants, RLS and client versions again immediately before rollout. Require explicit permission for grant changes.
4. Preserve the ability to restore the exact recorded grants on rollback, and verify real postflight. Do not activate the pilot for this.

Reference: issue #767 and historical draft PR #438.