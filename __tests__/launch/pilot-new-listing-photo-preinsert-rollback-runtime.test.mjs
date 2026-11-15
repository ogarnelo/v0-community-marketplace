import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const src=readFileSync("components/marketplace/new-listing-form.tsx","utf8");
const a=src.indexOf("  const uploadListingPhotos = async");
const b=src.indexOf("\n  const handleSubmit",a);
assert.ok(a>0&&b>a);
const extracted=src.slice(a,b)+"\nexports.uploadListingPhotos=uploadListingPhotos;";

function fixture({failAt=null,noPublicUrlAt=null,cleanupFails=false}={}){
  const operations=[];
  let uploadCount=0;
  let publicUrlCount=0;
  const storage={
    async upload(path,_file,_options){
      uploadCount++;
      operations.push(["upload",path]);
      return {error:uploadCount===failAt?{message:"PRIVATE_PROVIDER_ERROR"}:null};
    },
    getPublicUrl(path){
      publicUrlCount++;
      return {data:{publicUrl:publicUrlCount===noPublicUrlAt?null:"https://fixture.invalid/"+path}};
    },
    async remove(paths){
      operations.push(["remove",...[...paths]]);
      return {error:cleanupFails?{message:"PRIVATE_CLEANUP_FAILURE"}:null};
    }
  };
  const createClient=()=>({storage:{from:bucket=>{
    assert.equal(bucket,"listing-photos");
    return storage;
  }}});
  const trans=ts.transpileModule(extracted,{
    fileName:"uploadListingPhotos.tsx",reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
  });
  assert.equal((trans.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const exported={},logs=[];
  vm.runInNewContext(trans.outputText,{
    exports:exported,createClient,STORAGE_BUCKET:"listing-photos",
    sanitizeFileName:name=>name,Date,
    console:{error:(...args)=>logs.push(args)}
  },{timeout:1500});
  return {...exported,operations,logs};
}
const user="11111111-1111-4111-8111-111111111111";
const listing="22222222-2222-4222-8222-222222222222";
const file=name=>({file:{name},previewUrl:"blob://"+name,storagePath:null});
const reused={file:null,previewUrl:"https://fixture.invalid/existing.jpg",storagePath:user+"/drafts/existing.jpg"};

test("success leaves new photos intact and retains reused draft photo",async()=>{
 const f=fixture();
 const out=await f.uploadListingPhotos(listing,user,[reused,file("a.jpg"),file("b.jpg")]);
 assert.equal(out.length,3);
 assert.equal(out[0].url,reused.previewUrl);
 assert.deepEqual(f.operations.map(x=>x[0]),["upload","upload"]);
});
test("second upload failure removes only successfully uploaded new file, not reused draft image",async()=>{
 const f=fixture({failAt:2});
 await assert.rejects(f.uploadListingPhotos(listing,user,[reused,file("a.jpg"),file("b.jpg")]),
   e=>e.message==="listing_photo_upload_failed");
 assert.deepEqual(f.operations.map(x=>x[0]),["upload","upload","remove"]);
 assert.equal(f.operations[2].length,2);
 assert.ok(f.operations[2][1].startsWith(user+"/"+listing+"/"));
 assert.notEqual(f.operations[2][1],reused.storagePath);
});
test("failure obtaining public URL removes successfully uploaded file",async()=>{
 const f=fixture({noPublicUrlAt:1});
 await assert.rejects(f.uploadListingPhotos(listing,user,[file("a.jpg")]),
   e=>e.message==="listing_photo_upload_failed");
 assert.deepEqual(f.operations.map(x=>x[0]),["upload","remove"]);
});
test("failed cleanup never exposes provider diagnostic or touches unrelated file",async()=>{
 const f=fixture({failAt:2,cleanupFails:true});
 await assert.rejects(f.uploadListingPhotos(listing,user,[file("a.jpg"),file("b.jpg")]),e=>
   e.message==="listing_photo_upload_failed"&&!e.message.includes("PRIVATE"));
 assert.deepEqual(f.logs,[["new_listing_upload_cleanup_failed"]]);
 assert.equal(f.operations.filter(x=>x[0]==="remove").length,1);
});
test("first upload fails with no cleanup attempt or unrelated mutation",async()=>{
 const f=fixture({failAt:1});
 await assert.rejects(f.uploadListingPhotos(listing,user,[reused,file("a.jpg")]),e=>
   e.message==="listing_photo_upload_failed");
 assert.deepEqual(f.operations.map(x=>x[0]),["upload"]);
});
