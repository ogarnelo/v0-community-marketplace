import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const path="app/marketplace/listing/[id]/page.tsx";
const UUID="11111111-1111-4111-8111-111111111111";
const privateListing={
  id:UUID,title:"Private fixture",seller_id:"owner-fixture",
  status:"reserved",school_id:null,directory_school_code:null,
  description:"Synthetic",price:1,category:"libros",grade_level:"primaria"
};
const publicListing={...privateListing,status:"available"};

function pageFixture({listing=privateListing,user=null}={}){
  const state={adminCreated:0,photoReads:0,listingReads:0,authCalls:0};
  const supabaseAdmin={
    from(table){
      if(table==="listing_photos"){
        state.photoReads++;
        // Stop the authorized page before any unrelated JSX or client dependencies.
        throw Error("AUTHORIZED_PHOTO_FETCH_SENTINEL");
      }
      if(table==="schools")throw Error("fixture school_id must be null");
      assert.equal(table,"listings");
      state.listingReads++;
      return {select(){return this},eq(){return this},async maybeSingle(){return {data:listing,error:null}}};
    }
  };
  const client={
    auth:{async getUser(){state.authCalls++;return {data:{user}}}},
    from(table){
      assert.equal(table,"conversations");
      return {select(){return this},eq(){return this},or(){return this},
        limit(){return this},async maybeSingle(){return {data:null,error:null}}};
    }
  };
  const deps={
    "next/navigation":{notFound:()=>{throw Error("NOT_FOUND_SENTINEL")}},
    "@/lib/supabase/admin":{createAdminClient:()=>{state.adminCreated++;return supabaseAdmin}},
    "@/lib/supabase/server":{createClient:async()=>client},
    "@/lib/seo/demo-listing":{isDemoListing:()=>false},
    "@/lib/marketplace/listing-type":{getListingTypeFromRow:()=> "sale"},
    "react/jsx-runtime":{}
  };
  const source=readFileSync(path,"utf8");
  const transpiled=ts.transpileModule(source,{fileName:path,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
      jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},reportDiagnostics:true});
  assert.equal((transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};
  vm.runInNewContext(transpiled.outputText,{
    exports,require:id=>deps[id]??{},URL,console,Intl,Date
  },{filename:path,timeout:2000});
  return {state,page:exports.default,metadata:exports.generateMetadata};
}
const arg=id=>({params:Promise.resolve({id}),searchParams:Promise.resolve({})});
test("invalid listing UUID never creates privileged client in page or metadata",async()=>{
  const x=pageFixture();
  await assert.rejects(x.page(arg("not-a-uuid")),/NOT_FOUND_SENTINEL/);
  const metadata=await x.metadata({params:Promise.resolve({id:"not-a-uuid"})});
  assert.equal(metadata.robots.index,false);
  assert.equal(x.state.adminCreated,0);
  assert.equal(x.state.photoReads,0);
});
test("anonymous private listing never reads privileged photo objects",async()=>{
  const x=pageFixture({user:null});
  await assert.rejects(x.page(arg(UUID)),/NOT_FOUND_SENTINEL/);
  assert.equal(x.state.photoReads,0);
  assert.equal(x.state.listingReads,1);
});
test("nonparticipant private listing never reads privileged photo objects",async()=>{
  const x=pageFixture({user:{id:"outside-fixture"}});
  await assert.rejects(x.page(arg(UUID)),/NOT_FOUND_SENTINEL/);
  assert.equal(x.state.photoReads,0);
});
test("authorized owner reaches photo query only after checking visibility",async()=>{
  const x=pageFixture({user:{id:"owner-fixture"}});
  await assert.rejects(x.page(arg(UUID)),/AUTHORIZED_PHOTO_FETCH_SENTINEL/);
  assert.equal(x.state.photoReads,1);
  assert.equal(x.state.authCalls,1);
});
test("metadata for nonavailable listing does not fetch photo URL",async()=>{
  const x=pageFixture();
  const result=await x.metadata({params:Promise.resolve({id:UUID})});
  assert.equal(result.robots.index,false);
  assert.equal(x.state.photoReads,0);
});
test("metadata for available listing may fetch photo after verifying public status",async()=>{
  const x=pageFixture({listing:publicListing});
  await assert.rejects(x.metadata({params:Promise.resolve({id:UUID})}),
    /AUTHORIZED_PHOTO_FETCH_SENTINEL/);
  assert.equal(x.state.photoReads,1);
});
