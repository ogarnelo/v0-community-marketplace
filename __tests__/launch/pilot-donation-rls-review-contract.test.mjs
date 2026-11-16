import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const pre=readFileSync("scripts/p0_donation_rls_preflight_read_only.sql","utf8");
const candidate=readFileSync("scripts/p0_donation_rls_remediation_review_only.sql","utf8");
const manifest=readFileSync("package.json","utf8");
test("P0 591 preflight has read-only transaction, no DDL/DML",()=>{
  assert.match(pre,/BEGIN READ ONLY;/);
  assert.match(pre,/COMMIT;/);
  assert.doesNotMatch(pre,/^\s*(ALTER|DROP|CREATE|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b/im);
});
test("P0 591 preflight inspects exact policy, current grants and schema",()=>{
  for(const marker of ["pg_policies","information_schema.columns","pg_indexes","pg_constraint",
    "has_table_privilege","donation_requests","listings"])
    assert.ok(pre.includes(marker),marker);
});
test("P0 591 preflight counts cross-school mismatch, duplicates and unexpected state",()=>{
  for(const marker of ["IS DISTINCT FROM l.school_id","HAVING count(*)>1",
   "assigned_to_requester_id IS NOT NULL","approved_by_admin_id IS NOT NULL"])
     assert.ok(pre.includes(marker),marker);
});
test("P0 591 candidate is not in migrations and retains preflight -> change -> postflight -> commit",()=>{
 assert.match(candidate,/CANDIDATO DDL REVIEW ONLY.*NO APLICAR/);
 assert.ok(candidate.indexOf("DO $gate$")<candidate.indexOf("CREATE UNIQUE INDEX"));
 assert.ok(candidate.indexOf("CREATE UNIQUE INDEX")<candidate.indexOf("ALTER POLICY"));
 assert.ok(candidate.indexOf("ALTER POLICY")<candidate.indexOf("DO $postflight$"));
 assert.ok(candidate.indexOf("DO $postflight$")<candidate.lastIndexOf("COMMIT;"));
 assert.doesNotMatch(candidate,/DISABLE ROW LEVEL SECURITY|SECURITY DEFINER|GRANT ALL|REVOKE ALL/);
});
test("P0 591 policy only permits authenticated pending inserts with no approval data",()=>{
 assert.match(candidate,/ON public\.donation_requests TO authenticated/);
 for(const expr of ["status = 'pending'","assigned_to_requester_id IS NULL",
 "approved_by_admin_id IS NULL","l.listing_type = 'donation'","l.status = 'available'",
 "l.school_id IS NOT DISTINCT FROM donation_requests.school_id","l.seller_id IS DISTINCT FROM"])
  assert.ok(candidate.includes(expr),expr);
});
test("P0 591 index prevents two approved requests for the same listing",()=>{
 assert.match(candidate,/CREATE UNIQUE INDEX donation_requests_one_approved_per_listing_idx/);
 assert.match(candidate,/WHERE status = 'approved' AND listing_id IS NOT NULL/);
});
test("P0 591 proposal does not change ordinary table grants, roles or policies of other tables",()=>{
 assert.equal((candidate.match(/\bALTER POLICY\b/g)||[]).length,1);
 assert.doesNotMatch(candidate,/^\s*(GRANT|REVOKE|ALTER ROLE|DROP POLICY|CREATE POLICY)\b/im);
 assert.match(candidate,/Users can create donation requests/);
});
test("P0 591 proposal is never part of package prebuild or automatic migrations",()=>{
 const pkg=JSON.parse(manifest);
 assert.ok(!JSON.stringify(pkg.scripts||{}).includes("p0_donation_rls_remediation_review_only"));
 assert.ok(!pre.includes("CREATE UNIQUE INDEX"));
 assert.ok(!candidate.includes("ALTER DEFAULT PRIVILEGES"));
});
