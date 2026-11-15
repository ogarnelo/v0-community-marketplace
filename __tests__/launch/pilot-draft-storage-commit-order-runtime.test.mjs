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
function fixture({failOperation=null,storageFails=false,storageThrows=false,publishedReference=false,lookupFails=false,photoRowReference=false,photoLookupFails=false}={}){
 const steps=[];
 let lastAction="read";
 const supabase={auth:{getUser:async()=>({data:{user:{id:uid}}})}};
 const admin={
  from(table){
   if(table==="listings"){
     const published=new Proxy({},{get(_t,prop){
       if(prop==="maybeSingle")return async()=>{
         steps.push("reference_check");
         return {data:publishedReference?{id:"already-published"}:null,
           error:lookupFails?{message:"PRIVATE_REFERENCE_LOOKUP_ERROR"}:null};
       };
       return()=>published;
     }});
     return published;
   }
   if(table==="listing_photos"){
     const photoQuery=new Proxy({},{get(_t,prop){
       if(prop==="maybeSingle")return async()=>{
         steps.push("photo_row_check");
         return {data:photoRowReference?{id:"existing-photo-row"}:null,
           error:photoLookupFails?{message:"PRIVATE_PHOTO_LOOKUP_ERROR"}:null};
       };
       return()=>photoQuery;
     }});
     return photoQuery;
   }
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
    return {getPublicUrl:()=>({data:{publicUrl:previous.photos[0].url}}),remove:async(paths)=>{
      steps.push("storage_remove");
      assert.deepEqual([...paths],[uid+"/drafts/old.jpg"]);
      if(storageThrows)throw Error("PRIVATE_STORAGE_THROWN");
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
 assert.equal(r.status,200);assert.deepEqual(steps,["read","upsert","reference_check","photo_row_check","storage_remove"]);
});
test("DELETE failure retains photo files for retry",async()=>{
 const {handlers,steps}=fixture({failOperation:"delete"});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,500);assert.deepEqual(steps,["read","delete"]);
});
test("DELETE first commits DB deletion, then cleans Storage",async()=>{
 const {handlers,steps}=fixture();
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);assert.deepEqual(steps,["read","delete","reference_check","photo_row_check","storage_remove"]);
 assert.deepEqual(await r.json(),{ok:true});
});
test("DELETE Storage cleanup error returns committed result, never a false 500",async()=>{
 const {handlers,steps}=fixture({storageFails:true});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);assert.deepEqual(steps,["read","delete","reference_check","photo_row_check","storage_remove"]);
 assert.deepEqual(await r.json(),{ok:true,cleanupPending:true});
 assert.equal(r.headers.get("cache-control"),"private, no-store");
});

test("PUT does not delete a draft path referenced by a published listing",async()=>{
 const {handlers,steps}=fixture({publishedReference:true});
 const r=await handlers.PUT(body("PUT",{payload:{title:"changed"},photos:[]}));
 assert.equal(r.status,200);
 assert.deepEqual(steps,["read","upsert","reference_check"]);
});
test("DELETE preserves published draft photo even without client preservePhotoPaths",async()=>{
 const {handlers,steps}=fixture({publishedReference:true});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{ok:true});
 assert.deepEqual(steps,["read","delete","reference_check"]);
});
test("DELETE fails closed on uncertain reference check and reports cleanup pending",async()=>{
 const {handlers,steps}=fixture({lookupFails:true});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{ok:true,cleanupPending:true});
 assert.deepEqual(steps,["read","delete","reference_check"]);
});
test("PUT fails closed on uncertain reference check and preserves newly saved draft",async()=>{
 const {handlers,steps}=fixture({lookupFails:true});
 const r=await handlers.PUT(body("PUT",{payload:{title:"changed"},photos:[]}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).cleanupPending,true);
 assert.deepEqual(steps,["read","upsert","reference_check"]);
});

test("PUT preserves a draft photo referenced only by listing_photos",async()=>{
 const {handlers,steps}=fixture({photoRowReference:true});
 const r=await handlers.PUT(body("PUT",{payload:{title:"changed"},photos:[]}));
 assert.equal(r.status,200);
 assert.deepEqual(steps,["read","upsert","reference_check","photo_row_check"]);
});
test("DELETE preserves draft photo metadata referenced by a published listing",async()=>{
 const {handlers,steps}=fixture({photoRowReference:true});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{ok:true});
 assert.deepEqual(steps,["read","delete","reference_check","photo_row_check"]);
});
test("DELETE does not delete Storage when listing_photos lookup fails",async()=>{
 const {handlers,steps}=fixture({photoLookupFails:true});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{ok:true,cleanupPending:true});
 assert.deepEqual(steps,["read","delete","reference_check","photo_row_check"]);
});
test("PUT keeps the image when photo reference lookup fails",async()=>{
 const {handlers,steps}=fixture({photoLookupFails:true});
 const r=await handlers.PUT(body("PUT",{payload:{title:"changed"},photos:[]}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).cleanupPending,true);
 assert.deepEqual(steps,["read","upsert","reference_check","photo_row_check"]);
});

test("PUT Storage cleanup returned error still confirms DB commit and flags pending cleanup",async()=>{
 const {handlers,steps}=fixture({storageFails:true});
 const r=await handlers.PUT(body("PUT",{payload:{title:"changed"},photos:[]}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).cleanupPending,true);
 assert.deepEqual(steps,["read","upsert","reference_check","photo_row_check","storage_remove"]);
});
test("PUT Storage exception after commit never reports failed save",async()=>{
 const {handlers,steps}=fixture({storageThrows:true});
 const r=await handlers.PUT(body("PUT",{payload:{title:"changed"},photos:[]}));
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"private, no-store");
 const b=await r.json();assert.equal(b.cleanupPending,true);assert.equal(b.draft.id,"draft");
 assert.deepEqual(steps,["read","upsert","reference_check","photo_row_check","storage_remove"]);
 assert.doesNotMatch(JSON.stringify(b),/PRIVATE_STORAGE/);
});
test("DELETE Storage exception after commit never reports failed discard",async()=>{
 const {handlers,steps}=fixture({storageThrows:true});
 const r=await handlers.DELETE(body("DELETE",{}));
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"private, no-store");
 assert.deepEqual(await r.json(),{ok:true,cleanupPending:true});
 assert.deepEqual(steps,["read","delete","reference_check","photo_row_check","storage_remove"]);
});
