import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const candidate=readFileSync("scripts/p0_federation_representation_schema_review_only.sql","utf8");
const pack=JSON.parse(readFileSync("package.json","utf8"));
const tables=["organizations","associations","association_schools","org_associations","org_hierarchy","memberships"].map(x=>"federation_reporting_"+x);
test("review-only federation schema is not included in migrations or automatic scripts",()=>{
 assert.match(candidate,/REVIEW ONLY/);
 assert.doesNotMatch(JSON.stringify(pack.scripts),/p0_federation_representation_schema_review_only/);
 const workflow=readFileSync(".github/workflows/contracts.yml","utf8");
 assert.doesNotMatch(workflow,/psql.*p0_federation_representation_schema_review_only/);
});
test("legal AMPA distinct from school; memberships only report_viewer",()=>{
 assert.match(candidate,/CREATE TABLE public\.federation_reporting_associations/);
 assert.match(candidate,/association_id uuid NOT NULL REFERENCES public\.federation_reporting_associations/);
 assert.match(candidate,/school_id uuid NOT NULL REFERENCES public\.schools/);
 assert.match(candidate,/CHECK \(role='report_viewer'\)/);
 assert.doesNotMatch(candidate,/ALTER TABLE public\.user_roles|INSERT INTO public\.user_roles/);
});
test("every new table enables RLS and client grants are explicitly revoked",()=>{
 for(const name of tables){
  assert.ok(candidate.includes("CREATE TABLE public."+name+" "),name+" CREATE");
  assert.ok(candidate.includes("ALTER TABLE public."+name+" ENABLE ROW LEVEL SECURITY;"),name+" RLS");
  assert.ok(candidate.includes("public."+name),name+" REVOKE");
 }
 assert.match(candidate,/FROM PUBLIC, anon, authenticated;/);
 assert.match(candidate,/NO_GO_FEDERATION_PUBLIC_GRANTS/);
 assert.match(candidate,/NO_GO_FEDERATION_RLS_MISSING/);
});
test("candidate has transactional guard and no privilege escalation",()=>{
 assert.match(candidate,/BEGIN;/);
 assert.match(candidate,/COMMIT;/);
 assert.match(candidate,/SET LOCAL lock_timeout/);
 assert.doesNotMatch(candidate,/SECURITY DEFINER|DISABLE ROW LEVEL SECURITY|GRANT ALL/);
 assert.doesNotMatch(candidate,/ALTER DEFAULT PRIVILEGES|GRANT\s+supabase_admin\s+TO/);
});
test("representations are verified and time-bounded with defensive constraints",()=>{
 assert.match(candidate,/CHECK \(valid_until IS NULL OR valid_until > valid_from\)/);
 assert.match(candidate,/verified_by uuid REFERENCES auth\.users\(id\)/);
 assert.match(candidate,/CONSTRAINT federation_org_not_self CHECK \(parent_id <> child_id\)/);
 assert.match(candidate,/CHECK \(status IN \('pending','verified','revoked'\)\)/);
});
