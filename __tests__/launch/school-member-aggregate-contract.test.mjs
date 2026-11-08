import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("app/admin/school/page.tsx","utf8");
const sql=readFileSync("scripts/pilot-school-member-count-candidate.sql","utf8");

test("AMPA membership loads one school-restricted aggregate, not all family profiles",()=>{
  assert.match(source,/const effectiveSchoolId = schoolAdminRole\?\.school_id \|\| null/);
  assert.match(source,/if \(!effectiveSchoolId\) \{/);
  assert.ok(source.indexOf("if (!effectiveSchoolId)")<source.indexOf('.rpc("server_school_member_count"'));
  assert.match(source,/\.rpc\("server_school_member_count", \{ p_school_id: effectiveSchoolId \}\)/);
  assert.doesNotMatch(source,/profilesForCommunity|activeStudentContexts|safeMembers|ProfileSchoolContextRow|AccountStudentSchoolContextRow/);
  assert.doesNotMatch(source,/\.limit\(10000\)|\.limit\(20000\)/);
});

test("service-role count must fail explicitly on RPC error rather than report zero",()=>{
  assert.match(source,/memberCountError \|\| memberCountData == null/);
  assert.match(source,/throw new Error\("No se ha podido calcular la comunidad del centro\."\)/);
  assert.match(source,/Number\.isSafeInteger\(memberCount\)/);
  assert.match(source,/memberCount=\{memberCount\}/);
});

test("SQL aggregate returns only a number, honors profiles and never grants browser tokens",()=>{
  assert.match(sql,/create or replace function public\.server_school_member_count\(p_school_id uuid\)/i);
  assert.match(sql,/returns bigint/i);
  assert.match(sql,/security invoker/i);
  assert.match(sql,/select count\(\*\)/i);
  assert.match(sql,/select p\.id from public\.account_students a[\s\S]*join public\.profiles p/i);
  assert.match(sql,/union/i);
  assert.match(sql,/revoke all on function public\.server_school_member_count\(uuid\) from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.server_school_member_count\(uuid\) to service_role/i);
});
