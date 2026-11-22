import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const candidate = readFileSync("scripts/review_only/r3_donation_review_atomic_a002_candidate.sql","utf8");
const harness = readFileSync("scripts/qa/r3-donation-review-atomic-pg17.sh","utf8");
const route = readFileSync("app/api/donations/review/route.ts","utf8");
const pkg = JSON.parse(readFileSync("package.json","utf8"));

test("A002 atomic SQL remains review-only and cannot activate itself",()=>{
 assert.match(candidate,/REVIEW-ONLY ATOMIC DONATION REVIEW PROPOSAL/);
 assert.match(candidate,/NO_GO_A002_RPC_ALREADY_EXISTS/);
 assert.match(candidate,/NO_GO_A002_SCHEMA_OR_EXISTING_GUARDS_DRIFTED/);
 assert.match(candidate,/SECURITY INVOKER/);
 assert.match(candidate,/SET search_path = ''/);
 assert.match(candidate,/REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/);
 assert.match(candidate,/GRANT EXECUTE[\s\S]*TO service_role/);
 assert.doesNotMatch(JSON.stringify(pkg.scripts),/r3_donation_review_atomic_a002_candidate/);
 assert.doesNotMatch(candidate,/SECURITY DEFINER|ALTER POLICY|CREATE POLICY|DROP POLICY|DISABLE ROW LEVEL SECURITY/);
});

test("A002 list-lock, request-lock, role, school active and follow-up updates are transactional",()=>{
 const listingLock = candidate.indexOf("FROM public.listings AS li WHERE li.id=v_req.listing_id FOR UPDATE");
 const requestLock = candidate.indexOf("FROM public.donation_requests AS dr WHERE dr.id=p_request_id FOR UPDATE");
 const updateWinner = candidate.indexOf("UPDATE public.donation_requests AS dr SET");
 const archive = candidate.indexOf("UPDATE public.listings AS li SET status='archived'");
 const losers = candidate.indexOf("note='La donación ya fue asignada a otro solicitante.'");
 assert.ok(listingLock>0 && listingLock<requestLock && requestLock<updateWinner);
 assert.ok(updateWinner<archive && archive<losers);
 for (const x of ["v_school_active IS DISTINCT FROM true","v_admin_count<>1","v_matching_admin_count<>1","v_listing.listing_type IS DISTINCT FROM 'donation'","v_listing.status IS DISTINCT FROM 'available'","R3_DONATION_STATUS_CONFLICT"])assert.ok(candidate.includes(x),x);
 assert.match(candidate,/BEGIN;[\s\S]*CREATE FUNCTION[\s\S]*COMMIT;/);
});

test("A002 PG17 concurrency only exercises a disposable local database",()=>{
 assert.match(harness,/PGHOST=127\.0\.0\.1/);
 assert.match(harness,/wetudy_r3_donation_atomic_synthetic/);
 assert.match(harness,/Isolated PG17|PG17 disposable/);
 assert.match(harness,/Concurrent review expected exactly one winner/);
 assert.match(harness,/R3_DONATION_SCHOOL_INACTIVE/);
 assert.match(harness,/R3_DONATION_ROLE_SCOPE_DENIED/);
 assert.doesNotMatch(harness,/DATABASE_URL|supabase\.co|wetudy\.com/);
});

test("A002 atomic adapter cannot run without an explicit OFF-by-default switch",()=>{
 assert.match(route,/process\.env\.WETUDY_R3_DONATION_ATOMIC_REVIEW_ENABLED === "true"/);
 assert.match(route,/if \(atomicReviewEnabled\) \{/);
 assert.match(route,/\.rpc\(\s*"r3_review_donation_atomic"/);
 assert.equal((route.match(/if \(!atomicReviewEnabled\)/g)||[]).length,2);
 assert.match(route,/resolveUniqueSchoolAdminSchoolId/);
 assert.match(route,/\.from\("schools"\)[\s\S]*?\.select\("id, is_active"\)/);
 assert.match(route,/school\.is_active !== true/);
});
