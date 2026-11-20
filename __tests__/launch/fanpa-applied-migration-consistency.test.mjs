import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file="supabase/migrations/20261120110541_fanpa_service_only_representation_20261120.sql";
const applied=readFileSync(file,"utf8");
const candidate=readFileSync("docs/pilot/sql/fanpa_service_only_representation_review_20261120.sql","utf8");
function statements(s) {
 const body=s.slice(s.indexOf("CREATE TABLE public.fanpa_federations"));
 return body.replace(/COMMIT;[\s\S]*$/,"").trim();
}

test("approved migration preserves the tested FANPA candidate DDL verbatim",()=>{
 assert.equal(statements(applied),statements(candidate));
 assert.match(applied,/FANPA migration requires empty target tables/);
 assert.match(applied,/Existing role constraints unavailable/);
});
test("service-only permissions and RLS remain explicit, with no user_roles rewrite",()=>{
 for(const table of ["fanpa_federations","fanpa_administrators","fanpa_represented_schools"]){
  assert.ok(applied.includes("CREATE TABLE public."+table));
  assert.ok(applied.includes("ALTER TABLE public."+table+" ENABLE ROW LEVEL SECURITY"));
 }
 assert.match(applied,/FROM PUBLIC, anon, authenticated/);
 assert.match(applied,/TO service_role/);
 assert.doesNotMatch(applied,/ALTER TABLE public\.user_roles|DROP POLICY|CREATE POLICY|GRANT [\s\S]+ TO authenticated/);
 assert.match(applied,/active boolean NOT NULL DEFAULT false/);
});
