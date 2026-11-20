import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync("docs/pilot/sql/fanpa_service_only_representation_review_20261120.sql","utf8");
const workflow=readFileSync(".github/workflows/fanpa-representation-pg17.yml","utf8");

test("federation schema proposal cannot be auto-applied as a migration",()=>{
 assert.match(sql,/REVIEW ONLY/);
 assert.match(sql,/outside supabase\/migrations/);
 assert.match(workflow,/Apply proposal ONLY to temporary PG17 service/);
 assert.doesNotMatch(workflow,/mcp__Supabase__apply_migration|supabase db push/);
});
test("all three federation tables have RLS and client grants revoked",()=>{
 for(const name of ["fanpa_federations","fanpa_administrators","fanpa_represented_schools"]) {
  assert.match(sql,new RegExp("CREATE TABLE public\\."+name));
  assert.match(sql,new RegExp("ALTER TABLE public\\."+name+" ENABLE ROW LEVEL SECURITY"));
  assert.match(workflow,new RegExp(name));
 }
 assert.match(sql,/FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/TO service_role/);
 assert.doesNotMatch(sql,/CREATE POLICY|GRANT (SELECT|ALL) ON .* TO authenticated/);
 assert.doesNotMatch(sql,/ALTER TABLE public\.user_roles/);
});
test("links have real FK, explicit revocation and inactive defaults",()=>{
 assert.match(sql,/REFERENCES auth\.users\(id\)/);
 assert.match(sql,/REFERENCES public\.schools\(id\)/);
 assert.match(sql,/active boolean NOT NULL DEFAULT false/g);
 assert.match(sql,/PRIMARY KEY \(federation_id, user_id\)/);
 assert.match(sql,/PRIMARY KEY \(federation_id, school_id\)/);
 assert.match(workflow,/School revocation failed/);
});
