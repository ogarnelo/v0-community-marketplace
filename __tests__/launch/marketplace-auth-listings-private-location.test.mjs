import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const school=readFileSync("app/api/marketplace/my-school/route.ts","utf8");
const proposal=readFileSync("scripts/pilot-auth-listings-sensitive-grants-proposal.sql","utf8");
const fixture=readFileSync("scripts/pilot-auth-listings-sensitive-grants-qa.sql","utf8");
const workflow=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
test("school feed authorizes user before admin listings query",()=>{
  const verified=school.indexOf("if (authError || !user)");
  const scope=school.indexOf("const expression = makeMarketplaceSchoolFilter");
  const admin=school.indexOf("const admin = createAdminClient()");
  const listings=school.indexOf('admin.from("listings").select(FIELDS');
  assert.ok(verified>=0&&scope>verified&&admin>scope&&listings>admin);
  assert.match(school,/if \(!expression\)\s*\{/);
  assert.match(school,/\.eq\("status", "available"\)/);
  assert.doesNotMatch(school,/supabase\.from\("listings"\)/);
});
test("school feed keeps original count, pagination, filtering and privacy",()=>{
  assert.match(school,/applyMarketplaceFeedFilters\(/);
  assert.match(school,/const needsTotal = offset === 0 && !hasServerMarketplaceFilters\(filters\)/);
  assert.match(school,/\.range\(offset, offset \+ PAGE_SIZE\)/);
  assert.match(school,/postalCode: null, \/\//);
  assert.match(school,/approximateDistanceKm\(profile\?\.postal_code, item\.postal_code \|\| seller\?\.postalCode\)/);
});
test("auth column policy has 33 fields, excludes three geo fields",()=>{
  const match=proposal.match(/GRANT SELECT \(([^)]+)\)/);
  assert.ok(match);
  const cols=match[1].split(",").map(x=>x.trim());
  assert.equal(cols.length,33);
  for(const col of ["postal_code","lat","lng"])assert.ok(!cols.includes(col));
  for(const col of ["id","seller_id","user_id","status","school_id","is_demo","directory_school_code"])
    assert.ok(cols.includes(col));
  assert.match(proposal,/REVOKE SELECT ON TABLE public\.listings FROM authenticated/);
  assert.match(proposal,/has_table_privilege\('service_role','public\.listings','SELECT'\)/);
});
test("auth SQL fixture denies SELECT star and full geo on PG17; rolls back",()=>{
  assert.match(fixture,/SET LOCAL ROLE authenticated/);
  assert.match(fixture,/EXCEPTION WHEN insufficient_privilege/);
  assert.match(fixture,/PERFORM id, seller_id, status, title, is_demo/);
  assert.match(fixture,/ROLLBACK/);
  assert.match(workflow,/pilot-auth-listings-sensitive-grants-qa\.sql/);
});
