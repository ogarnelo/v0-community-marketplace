import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const owner="11111111-1111-4111-8111-111111111111";
const listing="22222222-2222-4222-8222-222222222222";
const filename="33333333-3333-4333-8333-333333333333.webp";
const bucket="listing-photos";
const host="https://cdn.example.invalid/storage/v1/object/public/listing-photos/";
const owned=owner+"/"+listing+"/"+filename;
const safe=host+owned;
const source=readFileSync("lib/marketplace/cleanup-deleted-listing-photos.ts","utf8");
const route=readFileSync("app/api/listings/delete/route.ts","utf8");
const compiled=ts.transpileModule(source,{fileName:"cleanup.ts",reportDiagnostics:true,
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const exports={};
vm.runInNewContext(compiled.outputText,{exports,require(name){
 if(name==="@/lib/supabase/admin")return{};
 throw Error("Unexpected import "+name);
},Map,Promise,URL,Set,decodeURIComponent,console:{error:()=>{}}},{timeout:2000});
function fixture({references=[],errors=[],storageFails=false}={}){
 const calls=[];
 const admin={
  storage:{from:name=>{
   assert.equal(name,bucket);
   return {
    getPublicUrl:path=>({data:{publicUrl:host+path}}),
    remove:async(paths)=>{calls.push({type:"remove",paths});return {error:storageFails?{message:"private"}:null}}
   };
  }},
  from:table=>{
   calls.push({type:"query",table});
   const q={select:()=>q,contains:()=>q,eq:()=>q,limit:()=>q,maybeSingle:async()=>({
    data:references.includes(table)?{id:listing}:null,
    error:errors.includes(table)?{message:"private"}:null
   })};
   return q;
  }
 };
 return {admin,calls,cleanup:urls=>exports.cleanupDeletedListingPhotos(admin,{ownerId:owner,listingId:listing,urls})};
}
test("deletes a unique own-listing object only after all four DB checks",async()=>{
 const h=fixture();
 await h.cleanup([safe,safe]);
 const q=h.calls.filter(x=>x.type==="query").map(x=>x.table);
 assert.equal(q.length,4);
 assert.deepEqual(h.calls.filter(x=>x.type==="remove").map(x=>Array.from(x.paths)),[[owned]]);
});
for(const [name,url] of [
 ["foreign user",host+"99999999-9999-4999-8999-999999999999/"+listing+"/"+filename],
 ["foreign listing",host+owner+"/99999999-9999-4999-8999-999999999999/"+filename],
 ["shared draft",host+owner+"/drafts/current/"+filename],
 ["external host", "https://untrusted.invalid/storage/v1/object/public/listing-photos/"+owned],
 ["URL with query",safe+"?bad=true"],
 ["wrong extension",safe.replace(".webp",".exe")],
 ["encoded slash",host+owner+"/"+listing+"/%2f"+filename],
 ["bad filename",host+owner+"/"+listing+"/listing.webp"]
]){
 test(name+" is never deleted",async()=>{
  const h=fixture();
  await h.cleanup([url]);
  assert.equal(h.calls.some(x=>x.type==="remove"),false);
 });
}
for(const table of ["listings","listing_photos","listing_drafts"]){
 test("reference or DB outage in "+table+" retains Storage object",async()=>{
  for(const settings of [{references:[table]},{errors:[table]}]){
   const h=fixture(settings);
   await h.cleanup([safe]);
   assert.equal(h.calls.some(x=>x.type==="remove"),false);
  }
 });
}
test("provider error is best effort and never leaks provider details to requester",async()=>{
 const h=fixture({storageFails:true});
 await assert.doesNotReject(h.cleanup([safe]));
 assert.equal(h.calls.filter(x=>x.type==="remove").length,1);
});
test("listing route only garbage collects after confirmed parent delete and no preserved history",()=>{
 assert.match(route,/select\("id,seller_id,status,photos"\)/);
 assert.match(route,/from\("listing_photos"\)[\s\S]*select\("url"\)/);
 assert.match(route,/if \(photoReadError\)/);
 assert.match(route,/cleanupDeletedListingPhotos\(admin/);
 assert.ok(route.indexOf("cleanupDeletedListingPhotos(admin")>route.indexOf("if (deleteError || !deleted)"));
 assert.ok(route.indexOf("cleanupDeletedListingPhotos(admin")>route.indexOf("if (history.some"));
 assert.match(route,/delete_not_confirmed/);
 assert.doesNotMatch(route,/from\("listing_photos"\)\.delete\(/);
});

test("real new listing upload Date.now()-index-sanitizedName.webp is eligible for safe GC",async()=>{
 const path=owner+"/"+listing+"/1732018500000-0-mochila-escolar.webp";
 const h=fixture();
 await h.cleanup([host+path]);
 assert.deepEqual(h.calls.filter(x=>x.type==="remove").map(x=>Array.from(x.paths)),[[path]]);
});
test("real current listing upload remains protected when DB reference exists",async()=>{
 const path=owner+"/"+listing+"/1732018500000-1-libro-texto.jpg";
 for(const table of ["listings","listing_photos","listing_drafts"]){
  const h=fixture({references:[table]});
  await h.cleanup([host+path]);
  assert.equal(h.calls.some(x=>x.type==="remove"),false);
 }
});
for(const filename of ["1732018500000-9-too-many.jpg","1732018500000-0-../../private.jpg",
 "1732018500000-0-evil.svg","1732018500000-0-.hidden.jpg",
 "1732018500000-0-evil..jpg","1732018500000-0-hola%2Fworld.jpg"]){
 test("suspicious generated-looking filename cannot be removed: "+filename,async()=>{
  const h=fixture();
  await h.cleanup([host+owner+"/"+listing+"/"+filename]);
  assert.equal(h.calls.some(x=>x.type==="remove"),false);
 });
}
test("canonical path check rejects URL aliases and encoded file representations",async()=>{
 const h=fixture();
 await h.cleanup([host+owner+"/"+listing+"/1732018500000-0-file%2Ejpg"]);
 assert.equal(h.calls.some(x=>x.type==="remove"),false);
});
