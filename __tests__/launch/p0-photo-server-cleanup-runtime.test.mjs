import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const source=readFileSync("app/api/uploads/sanitized-photo/route.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const USER="11111111-1111-4111-8111-111111111111",OTHER="22222222-2222-4222-8222-222222222222";
const FILE="33333333-3333-4333-8333-333333333333";
const draft=USER+"/drafts/current/"+FILE+".webp";
const other=OTHER+"/drafts/current/"+FILE+".webp";
const listing=USER+"/"+OTHER+"/"+FILE+".webp";
function fixture({user=USER,referenced=false,dbError=false,owner=USER,authError=false}={}){
 const removed=[],calls=[];
 const admin={
  from(table){
   const q={select(){return q},eq(){return q},contains(){return q},limit(){return q},
     async maybeSingle(){
       calls.push(table);
       if(table==="listings" && calls.length===1 && ![draft,other].includes(this.path))
         return {data:{seller_id:owner},error:null};
       return {data:referenced?{id:"reference"}:null,error:dbError?Error("PRIVATE"):null};
     }};
   return q;
  },
  storage:{from:()=>({
   getPublicUrl:path=>({data:{publicUrl:"https://storage.invalid/"+path}}),
   async remove(paths){removed.push(...paths);return {error:null}},
  })},
 };
 const exp={};
 const NextResponse={json:(body,opt={})=>({status:opt.status||200,body,cache:opt.headers?.["Cache-Control"]})};
 runInNewContext(js,{exports:exp,require(id){
   if(id==="next/server")return {NextResponse};
   if(id==="node:crypto")return {randomUUID:()=>FILE};
   if(id==="@/lib/supabase/server")return {createClient:async()=>({auth:{getUser:async()=>({
     data:{user:user?{id:user}:null},error:authError?Error("PRIVATE_AUTH"):null})}})};
   if(id==="@/lib/supabase/admin")return {createAdminClient:()=>admin};
   if(id==="@/lib/marketplace/server-photo-sanitizer")return {normalizePhoto:async()=>Buffer.from("safe")};
   throw Error("Unexpected "+id);
 },File,Buffer,console:{error:()=>{}}},{timeout:2000});
 return {removed,calls,delete:paths=>exp.DELETE({json:async()=>({paths})})};
}
test("unauthorized, foreign and malformed cleanup paths never call Storage",async()=>{
 const f=fixture();
 for(const paths of [[other],["../../etc"],[],Array(9).fill(draft)]){
   const r=await f.delete(paths);assert.equal(r.status,400);
 }
 assert.deepEqual(f.removed,[]);
 const noUser=fixture({user:null});
 assert.equal((await noUser.delete([draft])).status,401);
 const unavailable=fixture({authError:true});
 assert.equal((await unavailable.delete([draft])).status,503);
});
test("referenced drafts remain protected even when caller owns path",async()=>{
 const f=fixture({referenced:true});
 assert.equal((await f.delete([draft])).status,409);
 assert.deepEqual(f.removed,[]);
});
test("database error fails closed, never deleting a possibly published image",async()=>{
 const f=fixture({dbError:true});
 assert.equal((await f.delete([draft])).status,409);
 assert.deepEqual(f.removed,[]);
});
test("only an unreferenced own generated draft may be removed",async()=>{
 const f=fixture();
 const r=await f.delete([draft]);
 assert.equal(r.status,200);
 assert.equal(r.cache,"private, no-store");
 assert.deepEqual(f.removed,[draft]);
});
test("listing directory cleanup cannot touch another seller's listing",async()=>{
 const f=fixture({owner:OTHER});
 const r=await f.delete([listing]);
 assert.equal(r.status,403);
 assert.deepEqual(f.removed,[]);
});
