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

## Real local Next/browser compatibility subblock — CLOSED (20 November 2026)

**Passed on PR branch**: Chromium + actual Next.js 16 HTTP/SSR + local Supabase CLI GoTrue, PostgREST, JWT cookies and PostgreSQL RLS. The test copies the **unchanged production** API routes `app/api/schools/public/route.ts` and `app/api/marketplace/feed/route.ts` and their production Supabase SSR/admin/browser clients into a minimal, disposable Next app. It never uses wetudy.com or a hosted Supabase endpoint.

Evidence: [real local Next browser run 44818990343](https://github.com/ogarnelo/v0-community-marketplace/actions/runs/44818990343), **SUCCESS**; [critical contracts 44818990250](https://github.com/ogarnelo/v0-community-marketplace/actions/runs/44818990250), **SUCCESS**. The QA actors are guest, buyer, seller, and a third signed-in outsider (all fictional); fixtures contain no personal records. The guest sees no five-table data when granted SELECT but denied by RLS, and receives PostgREST `42501` after removing SELECT from `anon` on **only these five fixture tables**. Authenticated users retain their own profiles; only the buyer sees the fake saved search and demand; only buyer/seller see the fake agreement; the outsider sees no agreement. The real school public API returns only `id,name,city`, excludes inactive schools, and the real public marketplace API returns the identical listing payload before and after revocation without exposing seller postal codes. Guest distance search continues to return 401. HTTP results are compared before and after.

**Scope of this closed subblock**: the five-table change is deliberately mirrored on Supabase CLI's disposable `postgres` database, guarded by localhost-only connection and `PGAPPNAME=wetudy_disposable_next_browser_20261120`; the separate named-database SQL proposal remains hardened for the existing PG17 harness and is NOT executed against any hosted instance. This is a *representative, genuine full-stack test of these unchanged routes*, not a claim that the entire WETUDY web app, all private admin/registration screens or every external API consumer has been exercised.

Files: `scripts/pilot-anon-select-next-browser-local-fixture.sql`, `scripts/pilot-anon-select-next-browser-local-e2e.cjs`, `__tests__/launch/pilot-anon-next-browser-local-closure.test.mjs`, `.github/workflows/pilot-anon-select-next-browser-local.yml`. Workflow uses pinned, disposable dependencies and no production secrets; critical contracts require the guard.

Additional aggregate log metadata on 10–17 November (UTC) found **124** selected five-table REST requests, **zero observed JWT role `anon`**; combined with the **127** selected requests on 17–20 November, **251** matching requests in the sampled ten days had no recorded `anon` role. The 17–20 November RPC/GraphQL filtered review found six RPC POST requests, all with secret key credentials, and no GraphQL requests among those filtered events. These observations **cannot establish that dormant, third-party, scheduled, off-platform, unpublished or unclassified clients do not depend on guest grants**. Do not treat zero observed anonymous traffic as owner sign-off.

**Global privacy block still OPEN**. Remaining hold: inventory/atestación by owners of all clients that can call Data API, RPC, GraphQL, Realtime and views, including external websites, mobile builds, automation, offline tools, and inactive integrations; document each owner's environment, key/role type, tables/views/RPC consumed, guest requirement, and rollback acceptance. In addition, any final production change requires separate human review, approved plan, explicit permission, reversible rollout and verification. Pilot continues NO-GO; PR #787 remains DRAFT.

## External consumer owner attestation — OPEN (20 November 2026)

**Current gate: BLOCKED / NO-GO.** External absence is not established by source search, by read-only Postgres object metadata or by sampled API request logs. The [machine-readable attestation](./ANON_FIVE_TABLE_CONSUMER_ATTESTATION_2026-11-20.json) enumerates eight consumer classes, preserving missing owners and reviewer signoffs as `null` and explicit independent checks as `false`; it does **not** suggest approvals were received. The offline script `scripts/pilot-anon-external-consumer-gate.mjs --audit` validates the current blocked status; `--review-ready` **intentionally fails** until every class and review has independent, evidenced signoff. Critical-contracts CI asserts that this fail-closed behavior remains mandatory.

Actual first-party source classes discovered:

| Consumer class | Known technical evidence | Missing closure |
|---|---|---|
| WETUDY browser | `lib/supabase/client.ts`: `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Owner signoff for any other frontends/older builds |
| WETUDY server SSR | `lib/supabase/server.ts`: SSR cookies and user JWT on same public key | Owner confirms all deployed SSR environments |
| WETUDY privileged backend | `lib/supabase/admin.ts`: server-only service key | Independent inventory of all server deployments and exposed integrations |
| Scheduled Vercel handlers | `vercel.json`: school-impact-reports, super-admin-reports and email-health crons; other worker routes exist but are not registered there | Actual active schedules, downstream API use and deployment owner |
| Realtime agreement readers | `components/agreements/agreement-panel.tsx`, signed `/messages/[id]` page; isolated real WebSocket PASS | Any third-party Realtime consumers beyond the repository |
| Offline tools | Local school import, audit and QA scripts in `scripts/` | Independent evidence whether any client/old script still uses hosted credentials |
| Direct REST/vistas/RPC/GraphQL external clients | `public.demand_opportunities_30d` has `security_invoker=true`, currently anon SELECT on view; base `demand_requests` loses anon SELECT under proposed revoke | **Risk of changing an anonymous view call from empty data to HTTP 42501**, even if no row was leaked; identify consumer and decide compatibility |
| Other websites, apps, mobile versions, scheduled partner integrations and dormant clients | No individual consumers established by repo search | Independent owner attestation of presence **or evidenced absence**, including old versions and automation |

**Refined request-role evidence (read-only aggregate ClickHouse query, 10–20 Nov UTC):** 251 REST requests matching the five tables **and the two dependent invoker views**; 185 used a secret API key, and 66 used an inherited legacy `anon` API key **with an `authenticated` JWT authorization role**. Zero had an observed **effective `anon` role** (checking both `authorization.payload.role` and `apikey.payload.role` rather than mistakenly classifying a signed user with an anon API key as an anonymous guest). Zero direct matched view requests. Supabase reports **zero deployed Edge Functions**. The samples cannot establish who owns the requests, whether traffic was missed by logging, or whether an idle/external integration will run tomorrow. SDK family identification is **not** human owner attestation. These totals are not a guaranteed census of all requests.

**Evidence required before closing this same global block:** each owner must provide the client/app/integration identifier, deployment environment/version, secret vs publishable/legacy key *type only* (never paste any key/token), Auth role and session behavior, five-table/view/RPC access list, whether guests need those permissions, an isolated smoke outcome after the exact SQL change, rollback acceptance, a dated GitHub evidence link and an independent reviewer. Account for inactive integrations, partner apps, mobile binaries, offline tooling and any external use of `demand_opportunities_30d`. Confirm representative private family/admin browser routes in isolated QA. If a consumer cannot be identified, **do not mark it "absent"** and do not authorize a production REVOKE.

**CI assertions cannot replace real human signatures.** Even after future documentary review, any future production grant change requires an independently authorized change request with migration/rollback review. This PR contains no deployable permission migration and must stay DRAFT / NO-MERGE; pilot stays NO-GO.

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

1. Obtain independent, signed-off inventory of external Data API clients and any dormant callers; existing first-party AST inventory, RPC metadata, aggregated logs and local browser coverage are recorded above, but cannot prove absence of external/guest view consumers. The invoker view can change its guest error behavior.
2. The representative local full-stack Next public routes + three signed browser actors, plus separate actual Realtime WebSocket delivery, are now covered and green. Full registered-family/admin/private UI coverage with a production-equivalent schema and external consumers **remains** for approved isolated QA; these local fixtures are not identical to all hosted Supabase objects and policies.
3. Create a separate, independently reviewed production migration only after risk and compatibility checks; confirm current grants, RLS and client versions again immediately before rollout. Require explicit permission for grant changes.
4. Preserve the ability to restore the exact recorded grants on rollback, and verify real postflight. Do not activate the pilot for this.

Reference: issue #767 and historical draft PR #438.