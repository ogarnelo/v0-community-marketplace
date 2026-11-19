import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const route = readFileSync("app/marketplace/edit/[id]/page.tsx", "utf8");
const guard = route.match(/if \(!((?:\/\^)[^\n]+?\/[a-z]*)\.test\(id\)\) \{/);
assert.ok(guard, "Expected an early UUID guard with .test(id)");
const literal = guard[1];
assert.ok(literal.startsWith("/^") && literal.endsWith("/i"));
const uuid = new RegExp(literal.slice(1,literal.lastIndexOf("/")),literal.slice(literal.lastIndexOf("/")+1));

test("actual production listing UUID passes edit route guard", () => {
  assert.equal(uuid.test("05b1b6bd-ab1a-43a1-9c4d-17242ee4d3c9"), true);
  assert.equal(uuid.test("11111111-1111-4111-8111-111111111111"), true);
});

test("malformed IDs are still rejected before any privileged reads",()=>{
  for(const id of ["","abc","../../admin","05b1b6bd-ab1a-43a1-9c4d","05b1b6bd-ab1a-43a1-9c4d-17242ee4d3c9/"]) {
    assert.equal(uuid.test(id),false,id);
  }
  const idRead=route.indexOf("const { id } = await params");
  const guardAt=route.indexOf("if (!/^[0-9a-f]");
  const db=route.indexOf("const supabase = await createClient()");
  assert.ok(idRead>=0 && guardAt>idRead && db>guardAt);
  assert.match(route.slice(guardAt,db),/notFound\(\)/);
});

test("edit page still requires an authenticated seller",()=>{
  assert.match(route,/if \(!user\) \{/);
  assert.match(route,/typedListing\.seller_id !== user\.id/);
  assert.match(route,/redirect\("\/account\/listings"\)/);
});
