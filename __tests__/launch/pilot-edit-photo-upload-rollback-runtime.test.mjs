import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const src=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");
const start=src.indexOf("  const uploadNewPhotos = async () => {");
const end=src.indexOf("\n  const handleSubmit",start);
assert.ok(start>0&&end>start);
const helper=src.slice(start,end)+"\nexports.uploadNewPhotos=uploadNewPhotos;";
const uid="11111111-1111-4111-8111-111111111111";
const lid="22222222-2222-4222-8222-222222222222";
function fixture({failAt=0,noUrlAt=0,cleanupFails=false}={}){
 const ops=[];const logs=[];let uploads=0;let urls=0;
 const storage={
   async upload(path){uploads++;ops.push(["upload",path]);return{
    error:uploads===failAt?{message:"PRIVATE_PROVIDER_DIAGNOSTIC"}:null};},
   getPublicUrl(path){urls++;return{data:{
    publicUrl:urls===noUrlAt?null:"https://fixture.invalid/"+path
   }};},
   async remove(paths){ops.push(["remove",...[...paths]]);return{
    error:cleanupFails?{message:"PRIVATE_CLEANUP_DIAGNOSTIC"}:null};}
 };
 const createClient=()=>({storage:{from:bucket=>{
  assert.equal(bucket,"listing-photos");return storage;
 }}});
 const initialListing={id:lid};
 const currentUserId=uid;
 const newPhotos=[{file:{name:"a.jpg"}},{file:{name:"b.jpg"}}];
 const visibleExistingPhotos=[{id:"prior",url:"https://fixture.invalid/prior.jpg"}];
 const compiled=ts.transpileModule(helper,{fileName:"helper.tsx",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exp={};
 vm.runInNewContext(compiled.outputText,{exports:exp,createClient,initialListing,
  currentUserId,newPhotos,visibleExistingPhotos,STORAGE_BUCKET:"listing-photos",
  sanitizeFileName:x=>x,Date,console:{error:(...args)=>logs.push(args)}},
  {filename:"helper.tsx",timeout:1500});
 return {run:exp.uploadNewPhotos,ops,logs};
}
test("success retains prior photo and correctly orders new photos",async()=>{
 const f=fixture();const result=await f.run();
 assert.equal(result.length,2);
 assert.equal(result[0].sort_order,1);
 assert.equal(result[1].sort_order,2);
 assert.deepEqual(f.ops.map(x=>x[0]),["upload","upload"]);
});
test("second upload failure removes only successful new photo, never a prior one",async()=>{
 const f=fixture({failAt:2});
 await assert.rejects(f.run(),e=>e.message==="listing_edit_photo_upload_failed");
 assert.deepEqual(f.ops.map(x=>x[0]),["upload","upload","remove"]);
 assert.equal(f.ops[2].length,2);
 assert.match(f.ops[2][1],new RegExp("^"+uid+"/"+lid+"/"));
 assert.doesNotMatch(f.ops[2][1],/prior/);
});
test("missing URL after successful upload triggers cleanup",async()=>{
 const f=fixture({noUrlAt:1});
 await assert.rejects(f.run(),e=>e.message==="listing_edit_photo_upload_failed");
 assert.deepEqual(f.ops.map(x=>x[0]),["upload","remove"]);
});
test("cleanup failure is masked and logged without SQL or Storage details",async()=>{
 const f=fixture({failAt:2,cleanupFails:true});
 await assert.rejects(f.run(),e=>e.message==="listing_edit_photo_upload_failed");
 assert.deepEqual(f.logs,[["edit_listing_upload_cleanup_failed"]]);
});
test("failure on first upload never removes existing photo",async()=>{
 const f=fixture({failAt:1});
 await assert.rejects(f.run(),e=>e.message==="listing_edit_photo_upload_failed");
 assert.deepEqual(f.ops.map(x=>x[0]),["upload"]);
});
