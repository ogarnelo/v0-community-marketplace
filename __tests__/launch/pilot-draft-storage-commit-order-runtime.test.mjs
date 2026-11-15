import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const file="app/api/marketplace/listing-draft/route.ts";
const uid="11111111-1111-4111-8111-111111111111";
const previous={photos:[{url:"https://fixture.invalid/old.jpg",path:uid+"/drafts/old.jpg"}]};
const body=(method,payload)=>new Request("https://fixture.invalid/draft",{
 method,headers:{"content-type":"application/json"},body:JSON.stringify(payload)
});
function fixture({failOperation=null,storageFails=false}={}){
 const steps=[];
 let lastAction="read";
 const supabase={auth:{getUser:async()=>({data:{user:{id:uid}}})}};
 const admin={
  from(table){
   assert.equal(table,"listing_drafts");
   const q=new Proxy({},{get(_t,prop){
    if(prop==="upsert")return ()=>{lastAction="upsert";steps.push("upsert");return q};
    if(prop==="delete")return ()=>{lastAction="delete";steps.push("delete");return q};
    if(prop==="single"||prop==="maybeSingle")return async()=>{
      if(lastAction==="read"){steps.push("read");return {data:previous,error:null}}
      return {data:lastAction==="upsert"?{id:"draft"}:null,
        error:lastAction===failOperation?{message:"PRIVATE_SQL_ERROR"}:null}
    };
    if(prop==="then")return(resolve,reject)=>Promise.resolve({
      data:null,error:lastAction===failOperation?{message:"PRIVATE_SQL_ERROR"}:null
    }).then(resolve,reject);
    return()=>q;
   }});
   return q;
  },
  storage:{from(bucket){
    assert.equal(bucket,"listing-photos");
    return {remove:async(paths)=>{
      steps.push("storage_remove");
      assert.deepEqual([...paths],[uid+"/drafts/old.jpg"]);
      return {error:storageFails?{message:"PRIVATE_STORAGE_ERROR"}:null};
    }};
  }}
 };
 const mock={ "next/server":{NextResponse:{json:(data,opts={})=>new Response(JSON.stringify(data),{
    status:opts.status??200,headers:opts.headers??{}
  })}},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/supabase/server":{createClient:async()=>supabase}
 };
 const compiled=ts.transpileModule(readFileSync(file,"utf8"),{
   fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 });
 const handlers={};
 vm.runInNewContext(compiled.outputText,{exports:handlers,
   require:name=>mock[name]??{},Request,Response,Buffer,Set,Date,
   console:{error:()=>{}}
 },{filename:file,timeout:1500});
 return{handlers,steps};
}
test("PUT failure keeps old Storage objects and returns a private 500",async()=>{
 const {handlers,steps}=fixture({failOperation:"upsert"});
 const r=await handlers.PUT(body("PUT",{payload:{title:"updated"},photos:[]}));
 assert.equal(r.status,500);assert.equal(r.headers.get("cache-control"),"private, no-store");
 assert.deepEqual(steps,["read","upsert"]);
 assert.doesNotMatch(await r.text(),/PRIVATE_SQL_ERROR/);
});
test("PUT commits the new draft before removing its old photo",async()=>{
 const {handlers,steps}=fixture();
 const r=await handlers.PUT(body("PUT",{payload:{title:"updated"},photos:[]}));
 assert.equal(r.status,200);assert.deepEqual(steps,["read","upsert","storage_remove"]);
});
test("DELETE failure retains photo files for retry",async()=>{
 const {handlers,steps}=fixture({failOperation:"delete"});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,500);assert.deepEqual(steps,["read","delete"]);
});
test("DELETE first commits DB deletion, then cleans Storage",async()=>{
 const {handlers,steps}=fixture();
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);assert.deepEqual(steps,["read","delete","storage_remove"]);
 assert.deepEqual(await r.json(),{ok:true});
});
test("DELETE Storage cleanup error returns committed result, never a false 500",async()=>{
 const {handlers,steps}=fixture({storageFails:true});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);assert.deepEqual(steps,["read","delete","storage_remove"]);
 assert.deepEqual(await r.json(),{ok:true,cleanupPending:true});
 assert.equal(r.headers.get("cache-control"),"private, no-store");
});
