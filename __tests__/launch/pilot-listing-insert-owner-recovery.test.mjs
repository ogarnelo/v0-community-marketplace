import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {confirmOwnedListingInsert} from "../../lib/marketplace/confirm-owned-listing-insert.mjs";
const ts=createRequire(import.meta.url)("typescript");
const id="22222222-2222-4222-8222-222222222222";
const seller="11111111-1111-4111-8111-111111111111";
const owner={id,seller_id:seller};
test("confirmed INSERT must not require a further privileged read",async()=>{
 let lookups=0;
 const answer=await confirmOwnedListingInsert({listingId:id,sellerId:seller,
  insert:async()=>({error:null}),lookupOwned:async()=>{lookups++;return{data:owner,error:null}}});
 assert.equal(answer,"inserted");assert.equal(lookups,0);
});
test("HTTP error after actual commit is recovered by exact ID and seller",async()=>{
 let inserts=0;
 const answer=await confirmOwnedListingInsert({listingId:id,sellerId:seller,
  insert:async()=>{inserts++;return{error:{code:"PGRST301",message:"Private DB detail"}}},
  lookupOwned:async()=>({data:owner,error:null})});
 assert.equal(answer,"recovered");assert.equal(inserts,1);
});
test("network exception after commit is recoverable",async()=>{
 const answer=await confirmOwnedListingInsert({listingId:id,sellerId:seller,
  insert:async()=>{throw Error("Connection interrupted")},lookupOwned:async()=>({data:owner,error:null})});
 assert.equal(answer,"recovered");
});
for(const [label,data] of [
 ["no row",null],["wrong UUID",{id:"other",seller_id:seller}],
 ["wrong seller",{id,seller_id:"someone-else"}]
]){
 test(label+" must never be interpreted as committed listing",async()=>{
  await assert.rejects(confirmOwnedListingInsert({listingId:id,sellerId:seller,
   insert:async()=>({error:new Error("Private error")}),
   lookupOwned:async()=>({data,error:null})}),e=>e.message==="listing_insert_unconfirmed");
 });
}
test("failed RLS verification remains unconfirmed and hides private details",async()=>{
 await assert.rejects(confirmOwnedListingInsert({listingId:id,sellerId:seller,
  insert:async()=>({error:{message:"PRIVATE_SQL_DETAIL"}}),
  lookupOwned:async()=>({data:owner,error:{message:"PRIVATE_RLS_DETAIL"}})}),
  e=>e.message==="listing_insert_unconfirmed");
});
test("lookup network exception must not certify a listing",async()=>{
 await assert.rejects(confirmOwnedListingInsert({listingId:id,sellerId:seller,
  insert:async()=>{throw Error("socket closed")},
  lookupOwned:async()=>{throw Error("lookup crashed")}}),e=>e.message==="listing_insert_unconfirmed");
});
test("missing seller/ID cannot reconcile or call server",async()=>{
 let called=0;
 await assert.rejects(confirmOwnedListingInsert({listingId:id,sellerId:"",
  insert:async()=>{called++;return{error:null}},
  lookupOwned:async()=>{called++;return{data:owner}}}),/listing_insert_unconfirmed/);
 assert.equal(called,0);
});
test("new listing TSX parses and reuses the same ID across retries",()=>{
 const source=readFileSync("components/marketplace/new-listing-form.tsx","utf8");
 const compiled=ts.transpileModule(source,{fileName:"new-listing-form.tsx",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 assert.match(source,/const pendingListingIdRef = useRef<string \| null>\(null\)/);
 assert.match(source,/const listingId = pendingListingIdRef\.current \|\| crypto\.randomUUID\(\)/);
 assert.match(source,/pendingListingIdRef\.current = listingId/);
 assert.match(source,/lookupOwned: async \(\) => supabase\.from\("listings"\)/);
 assert.match(source,/\.eq\("seller_id", currentUserId\)/);
 assert.match(source,/if \(insertion === "recovered"\)/);
 assert.match(source,/router\.push\(\`\/marketplace\/edit\/\$\{listingId\}\?photosPending=1\`\)/);
});
test("synchronous submit guard protects against double-clicks",()=>{
 const source=readFileSync("components/marketplace/new-listing-form.tsx","utf8");
 const start=source.indexOf("const handleSubmit = async");
 const end=source.indexOf("  return (",start);
 const body=source.slice(start,end);
 assert.match(body,/if \(submissionInFlightRef\.current\) return;/);
 assert.match(body,/submissionInFlightRef\.current = true;/);
 assert.match(body,/finally \{\s*submissionInFlightRef\.current = false;/);
 assert.ok(body.indexOf("submissionInFlightRef.current = true")<body.indexOf("await uploadListingPhotos"));
});
