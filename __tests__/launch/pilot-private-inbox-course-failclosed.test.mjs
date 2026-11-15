import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const user={id:"11111111-1111-4111-8111-111111111111"};
const privateError=new Error("PRIVATE_SQL_UNSAFE_MESSAGE");
const queries={
 conversations:[{id:"22222222-2222-4222-8222-222222222222",buyer_id:user.id,
   seller_id:"33333333-3333-4333-8333-333333333333",
   listing_id:"44444444-4444-4444-8444-444444444444"}],
 hidden_conversations:[],
 listings:[{id:"44444444-4444-4444-8444-444444444444",title:"Synthetic listing"}],
 profiles:[{id:"33333333-3333-4333-8333-333333333333",full_name:"Test seller"}],
 messages:[{conversation_id:"22222222-2222-4222-8222-222222222222",body:"Sensitive synthetic",created_at:"2026-11-15T00:00:00Z",sender_id:user.id}],
 saved_searches:[{id:"55555555-5555-4555-8555-555555555555",intent_source:"",demand_request_id:null}],
 saved_search_matches:[{id:"66666666-6666-4666-8666-666666666666",listing_id:"44444444-4444-4444-8444-444444444444",
 saved_search_id:"55555555-5555-4555-8555-555555555555"}],
 course_needs:[]
};
function load(file, failing){
 const calls=[];
 const createQuery=table=>{
  calls.push(table);
  const respond=()=>({data:queries[table]??[],error:table===failing?privateError:null});
  const q=new Proxy({},{get(_t,name){
   if(name==="then")return (resolve,reject)=>Promise.resolve(respond()).then(resolve,reject);
   if(name==="maybeSingle"||name==="single")return async()=>respond();
   return ()=>q;
  }});
  return q;
 };
 const supabase={auth:{getUser:async()=>({data:{user}})},from:createQuery};
 const mocks={
  "@/lib/supabase/server":{createClient:async()=>supabase},
  "@/lib/supabase/admin":{createAdminClient:()=>({from:createQuery})},
  "@/lib/auth/server-user":{getCurrentUser:async()=>user},
  "next/navigation":{redirect:()=>{throw Error("REDIRECT")}},
 };
 const compiled=ts.transpileModule(readFileSync(file,"utf8"),{fileName:file,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
   jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const exports={};
 vm.runInNewContext(compiled.outputText,{
  exports,require:id=>mocks[id]??{},Promise,Date,Map,Set,URL,console,Intl
 },{filename:file,timeout:1500});
 return {run:()=>exports.default(),calls};
}
const cases=[
 ["app/messages/page.tsx","conversations","messages_inbox_unavailable"],
 ["app/messages/page.tsx","hidden_conversations","messages_inbox_unavailable"],
 ["app/messages/page.tsx","listings","messages_summary_unavailable"],
 ["app/messages/page.tsx","profiles","messages_summary_unavailable"],
 ["app/messages/page.tsx","messages","messages_summary_unavailable"],
 ["app/account/saved-searches/page.tsx","saved_searches","saved_searches_unavailable"],
 ["app/account/saved-searches/page.tsx","saved_search_matches","saved_searches_unavailable"],
 ["app/account/saved-searches/page.tsx","listings","saved_search_matches_listings_unavailable"]
];
for(const [file,table,expected] of cases){
 test(file+" private fail-closed on "+table,async()=>{
  const {run,calls}=load(file,table);
  await assert.rejects(run(),e=>{
   assert.equal(e.message,expected);
   assert.equal(e.message.includes("PRIVATE_SQL"),false);
   return true;
  });
  assert.ok(calls.includes(table));
 });
}
test("Mi curso never logs private SQL objects or treats failed RLS as missing students",()=>{
 const source=readFileSync("app/mi-curso/page.tsx","utf8");
 assert.match(source,/if \(profileError \|\| studentsError \|\| schoolsError \|\| listingsError\)/);
 assert.match(source,/throw new Error\("course_context_unavailable"\)/);
 assert.doesNotMatch(source,/console\.error\("Mi curso: error cargando/);
 assert.doesNotMatch(source,/console\.error\([^)]*,\s*(error|studentsError|profileError)/);
});
