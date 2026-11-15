import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const routePath="app/api/messages/conversation-summary/route.ts";
const CID="11111111-1111-4111-8111-111111111111";
const URL_ROOT="https://fixture.invalid/api/messages/conversation-summary";

function fixture({user="familyA",buyer="familyA",seller="familyB",
  conversationError=false,listingError=false,profileError=false,messageError=false}={}){
  const state={queries:[],admin:0};
  const record={id:CID,listing_id:"listing-fixture",buyer_id:buyer,seller_id:seller};
  const supabase={
    auth:{async getUser(){return {data:{user:user?{id:user}:null}}}},
    from(table){
      state.queries.push("user:"+table);
      const answer=()=>table==="conversations"
        ? {data:conversationError?null:record,error:conversationError?{message:"SECRET_CONVERSATION"}:null}
        : {data:{body:"PRIVATE_MESSAGE",created_at:"2026-11-15T00:00:00Z",attachment_name:null},
           error:messageError?{message:"SECRET_MESSAGE"}:null};
      const q={select(){return this},eq(){return this},order(){return this},
        limit(){return this},async maybeSingle(){return answer()}};
      return q;
    }
  };
  const admin={
    from(table){
      state.queries.push("admin:"+table);
      const reply=()=>table==="listings"
        ? {data:{title:"RESERVED_TITLE"},error:listingError?{message:"SECRET_LISTING"}:null}
        : {data:{full_name:"PRIVATE_USER"},error:profileError?{message:"SECRET_PROFILE"}:null};
      return {select(){return this},eq(){return this},async maybeSingle(){return reply()}};
    }
  };
  const requireMock=id=>{
    if(id==="next/server")return {NextResponse:{json:(body,options={})=>
      new Response(JSON.stringify(body),{status:options.status??200,headers:options.headers??{}})}};
    if(id==="@/lib/supabase/server")return {createClient:async()=>supabase};
    if(id==="@/lib/supabase/admin")return {createAdminClient:()=>{state.admin++;return admin}};
    throw Error("Unexpected dependency "+id);
  };
  const compiled=ts.transpileModule(readFileSync(routePath,"utf8"),{
    fileName:routePath,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const output={};
  vm.runInNewContext(compiled.outputText,{exports:output,require:requireMock,URL,Request,Response},
    {filename:routePath,timeout:1500});
  return {GET:output.GET,state};
}
const request=id=>new Request(URL_ROOT+(id===null?"":"?conversation_id="+encodeURIComponent(id)));
function privateResponse(res){assert.match(res.headers.get("cache-control")||"",/private, no-store/)}

test("anonymous request is private 401, zero queries",async()=>{
  const {GET,state}=fixture({user:null});
  const res=await GET(request(CID));
  assert.equal(res.status,401);privateResponse(res);
  assert.deepEqual(state.queries,[]);assert.equal(state.admin,0);
});
test("malformed and missing IDs are private 400 before DB access",async()=>{
  for(const id of ["not-uuid",null,"../outside"]){
    const {GET,state}=fixture();
    const res=await GET(request(id));
    assert.equal(res.status,400);privateResponse(res);
    assert.deepEqual(state.queries,[]);assert.equal(state.admin,0);
  }
});
test("nonparticipant cannot invoke privileged lookup even if RLS accidentally returns conversation",async()=>{
  const {GET,state}=fixture({user:"outsider"});
  const res=await GET(request(CID));
  assert.equal(res.status,404);privateResponse(res);
  assert.equal(state.admin,0);
  assert.deepEqual(state.queries,["user:conversations"]);
});
test("conversation lookup failure reveals no backend details",async()=>{
  const {GET,state}=fixture({conversationError:true});
  const res=await GET(request(CID));
  assert.equal(res.status,404);privateResponse(res);
  assert.equal((await res.text()).includes("SECRET_CONVERSATION"),false);
  assert.equal(state.admin,0);
});
test("authorized participant can fetch reserved title and latest private message",async()=>{
  const {GET,state}=fixture();
  const res=await GET(request(CID));
  assert.equal(res.status,200);privateResponse(res);
  const data=await res.json();
  assert.equal(data.conversation.listingTitle,"RESERVED_TITLE");
  assert.equal(data.conversation.latestMessageBody,"PRIVATE_MESSAGE");
  assert.equal(state.admin,1);
});
test("any privileged summary read failure returns private generic 503, never partial content",async()=>{
  for(const failure of ["listingError","profileError","messageError"]){
    const {GET}=fixture({[failure]:true});
    const res=await GET(request(CID));
    assert.equal(res.status,503);privateResponse(res);
    const body=await res.text();
    assert.equal(body.includes("SECRET_"),false);
    assert.equal(body.includes("PRIVATE_MESSAGE"),false);
  }
});
