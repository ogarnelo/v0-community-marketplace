import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const home=readFileSync("app/marketplace/page.tsx","utf8");
const feed=readFileSync("app/api/marketplace/feed/route.ts","utf8");
const school=readFileSync("app/api/marketplace/my-school/route.ts","utf8");
const files=[["homepage",home],["feed",feed],["my-school",school]];
test("all three production surfaces read listings through server-only service role",()=>{
  for(const [name,src] of files){
    assert.match(src,/createAdminClient/,"no server admin client in "+name);
    assert.doesNotMatch(src,/supabase\.from\("listings"\)/,"client listing read in "+name);
    assert.match(src,/admin\.from\("listings"\)/,"service listing read missing "+name);
  }
});
test("server bypass listing queries retain RLS-equivalent public status and school scope",()=>{
  assert.match(home,/\.eq\("status", "available"\)/);
  assert.match(feed,/\.eq\("status", "available"\)/);
  assert.match(school,/\.eq\("status", "available"\)/);
  const auth=school.indexOf("if (authError || !user)");
  const filter=school.indexOf("const expression = makeMarketplaceSchoolFilter");
  const query=school.indexOf('admin.from("listings")');
  assert.ok(auth>=0&&filter>auth&&query>filter,"school scope must be verified before service role bypass");
  assert.match(school,/if \(!expression\)/);
});
test("all three production catalog card payloads exclude seller exact postcode",()=>{
  for(const [name,src] of files){
    assert.match(src,/postalCode: null/,"postalCode must be null in "+name);
    assert.doesNotMatch(src,/postalCode: item\.postal_code/);
  }
});
