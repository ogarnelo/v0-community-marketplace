import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const pre=readFileSync("scripts/p0_school_admin_global_uniqueness_preflight_read_only.sql","utf8");
const candidate=readFileSync("scripts/p0_school_admin_global_uniqueness_candidate_review_only.sql","utf8");
const pkg=JSON.parse(readFileSync("package.json","utf8"));

test("preflight contains only SELECT statements in READ ONLY transaction",()=>{
 const plain=pre.replace(/--[^\n]*/g,"");
 assert.match(plain,/BEGIN READ ONLY;/);
 assert.match(plain,/COMMIT;/);
 assert.doesNotMatch(plain,/\b(?:CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|EXECUTE|CALL|DO)\b/i);
 assert.match(plain,/count\(DISTINCT school_id\) > 1/);
 assert.match(plain,/pg_indexes/);
 assert.match(plain,/pg_constraint/);
});

test("proposed constraint is global per user and excludes super admin",()=>{
 assert.match(candidate,/REVIEW-ONLY CANDIDATE/);
 assert.match(candidate,/CREATE UNIQUE INDEX user_roles_one_school_admin_per_user_idx/);
 assert.match(candidate,/ON public\.user_roles \(user_id\)/);
 assert.match(candidate,/WHERE role = 'school_admin'/);
 assert.match(candidate,/HAVING count\(\*\) > 1/);
 assert.match(candidate,/indisunique AND ix\.indisvalid AND ix\.indisready/);
 assert.match(candidate,/SET LOCAL lock_timeout/);
 assert.match(candidate,/SET LOCAL statement_timeout/);
 assert.doesNotMatch(candidate,/\b(?:REVOKE|GRANT|ALTER POLICY|DISABLE ROW LEVEL SECURITY)\b/);
});

test("candidate is never wired into CI, prebuild or migrations",()=>{
 const scripts=JSON.stringify(pkg.scripts??{});
 assert.doesNotMatch(scripts,/p0_school_admin_global_uniqueness_candidate_review_only/);
 assert.doesNotMatch(pre,/CREATE UNIQUE INDEX/);
 const workflows=readFileSync(".github/workflows/contracts.yml","utf8");
 assert.doesNotMatch(workflows,/\bpsql\b.*p0_school_admin_global_uniqueness_candidate_review_only/);
});
