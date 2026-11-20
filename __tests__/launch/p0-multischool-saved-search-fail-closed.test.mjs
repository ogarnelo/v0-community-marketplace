import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const helper=readFileSync("lib/marketplace/multischool-alert-context.ts","utf8");
const route=readFileSync("app/api/marketplace/saved-searches/route.ts","utf8");
const client=readFileSync("components/marketplace/marketplace-client.tsx","utf8");
const out={};
runInNewContext(ts.transpileModule(helper,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:out});
const {resolveSingleCommunityAlertContext:resolve}=out;
// Values produced in vm have another realm prototype; compare serialized data.
const plain=(...args)=>JSON.parse(JSON.stringify(resolve(...args)));
const A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222";
const school=(id)=>({school_id:id,directory_school_code:null});
const dir=(code)=>({school_id:null,directory_school_code:code});
test("one active student persists precise school identity without using a stale profile",()=>{
 assert.deepEqual(plain([school(A)],school(B)),{schoolId:A,directoryCode:null,ambiguous:false});
 assert.deepEqual(plain([dir("28000001")],school(B)),{schoolId:null,directoryCode:"28000001",ambiguous:false});
});
test("multiple distinct schools never silently collapse into first-school alerts",()=>{
 for(const students of [[school(A),school(B)],[school(A),dir("28000001")],
   [dir("28000001"),dir("28000002")]]) {
   assert.deepEqual(plain(students,school(A)),{schoolId:null,directoryCode:null,ambiguous:true});
 }
 assert.deepEqual(plain([school(A),school(A)],school(B)),{schoolId:A,directoryCode:null,ambiguous:false});
});
test("active student with no school cannot restore an old profile school",()=>{
 assert.deepEqual(plain([{school_id:null,directory_school_code:null}],school(A)),
  {schoolId:null,directoryCode:null,ambiguous:false});
 assert.deepEqual(plain([],school(A)),{schoolId:A,directoryCode:null,ambiguous:false});
});
test("malformed, conflicting or unbounded school data fail closed",()=>{
 for(const contexts of [[school("../../../x")],[{school_id:A,directory_school_code:"28000001"}],
    [dir("not,valid")], Array(101).fill(school(A))]) {
   assert.throws(()=>resolve(contexts,school(B)));
 }
});
test("saved-search route enforces authenticated multi-school scope and 409 before insert",()=>{
 assert.match(route,/process\.env\.WETUDY_MULTISCHOOL_LISTINGS_ENABLED === "true"/);
 assert.match(route,/resolveUniqueSchoolAdminSchoolId\(rolesResult\.data\)/);
 assert.match(route,/\.eq\("owner_user_id", user\.id\)\.eq\("active", true\)\.limit\(101\)/);
 assert.match(route,/resolveSingleCommunityAlertContext\(/);
 assert.match(route,/multi_school_saved_search_not_supported/);
 assert.match(route,/status: 409, headers: \{ "Cache-Control": "private, no-store" \}/);
 assert.ok(route.indexOf("multi_school_saved_search_not_supported") < route.indexOf('.from("saved_searches")'));
 assert.doesNotMatch(route,/body\.schoolId|body\.directorySchoolCode/);
 assert.match(route,/if \(body\.onlyMyCommunity && !directorySchoolCode && !schoolId &&\s*familyScopeMode !== "active_family"\)/);
 assert.match(route,/WETUDY_MULTISCHOOL_ALERT_SCOPE_ENABLED !== "true"/);
});
test("authentication provider errors fail closed before any saved-search writes",()=>{
 assert.match(route,/error: authError \} = await supabase\\.auth\\.getUser\\(\\)/);
 const auth=route.indexOf("if (authError) {");
 assert.ok(auth>0);
 assert.ok(auth<route.indexOf('.from("saved_searches")'));
 assert.match(route.slice(auth,auth+500),/AuthSessionMissingError/);
 assert.match(route.slice(auth,auth+500),/session_not_found/);
 assert.match(route.slice(auth,auth+500),/auth_unavailable/);
 assert.match(route.slice(auth,auth+500),/status: sessionMissing \? 401 : 503/);
 assert.match(route.slice(auth,auth+500),/private, no-store/);
});

test("context read failures deny saving before the insert or stale-school fallback",()=>{
 assert.match(route,/\{ data: profile, error: profileError \}/);
 assert.match(route,/\{ data: schoolAdminRole, error: schoolAdminRoleError \}/);
 assert.match(route,/\{ data: primaryStudentContext, error: primaryStudentContextError \}/);
 const deny=route.indexOf("if (profileError || schoolAdminRoleError || primaryStudentContextError)");
 assert.ok(deny>0);
 assert.ok(deny < route.indexOf("if (radiusKm !== null && !hasKnownPostalCode"));
 assert.ok(deny < route.indexOf('.from("saved_searches")'));
 assert.match(route.slice(deny, deny+300),/school_context_unavailable/);
 assert.match(route.slice(deny, deny+300),/status: 503/);
});

test("client explains limited notifications instead of promising unimplemented multi-school alerts",()=>{
 assert.match(client,/payload\?\.error === "multi_school_saved_search_not_supported"/);
 assert.match(client,/saveSearchStatus === "multischool"/);
 assert.match(client,/avisos conjuntos aún no están disponibles/);
 assert.match(client,/Desactiva «Solo mi comunidad»/);
});
