import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
function setup(opts={}){
 const events=[],exp={};
 const src=readFileSync("lib/commerce/buy-now-reservation.ts","utf8");
 const transpiled=ts.transpileModule(src,{fileName:"buy-now-reservation.ts",reportDiagnostics:true,
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(transpiled.outputText,{exports:exp,require:()=>({}),Error,Promise},
 {filename:"buy-now-reservation.ts",timeout:1800});
 const from=table=>{
  events.push("FROM:"+table);
  const filters=[],q={
   update:row=>{events.push("UPDATE:"+JSON.stringify(row));return q;},
   eq:(key,value)=>{filters.push([key,value]);return q;},
   select:cols=>{events.push("SELECT:"+cols);return q;},
   maybeSingle:async()=>{
     events.push("FILTERS:"+JSON.stringify(filters));
     return {data:opts.conflict?null:{id:ID},error:opts.error?{message:"PRIVATE_DB"}:null};
   }
  };
  return q;
 };
 return {events,reserve:()=>exp.reserveAvailableListing({admin:{from},listingId:ID})};
}
test("atomic status CAS succeeds and confirms the listing id",async()=>{
 const h=setup(),id=await h.reserve();
 assert.equal(id,ID);
 assert.ok(h.events.includes('UPDATE:{"status":"reserved"}'));
 assert.ok(h.events.includes('FILTERS:[["id","'+ID+'"],["status","available"]]'));
});
test("losing reserve CAS returns 409 without provider details",async()=>{
 const h=setup({conflict:true});
 await assert.rejects(h.reserve(),e=>e.status===409&&!/PRIVATE_/.test(e.publicMessage));
 assert.equal(h.events.filter(x=>x.startsWith("UPDATE:")).length,1);
});
test("database error returns 503 without provider details",async()=>{
 const h=setup({error:true});
 await assert.rejects(h.reserve(),e=>e.status===503&&!/PRIVATE_/.test(e.publicMessage));
});
test("winner and loser isolated by UPDATE affected-row acknowledgement",async()=>{
 const winner=setup(),loser=setup({conflict:true});
 assert.equal(await winner.reserve(),ID);
 await assert.rejects(loser.reserve(),e=>e.status===409);
 assert.equal(loser.events.some(x=>x.includes("INSERT:")),false);
});
test("buy-now checks both current and globally accepted offers before attempting CAS",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 const global=s.indexOf('const { data: otherAccepted');
 const own=s.indexOf('const { data: activeOffer');
 const reserve=s.indexOf('await reserveAvailableListing');
 const chat=s.indexOf('const { data: existingConversation');
 const offer=s.indexOf('.from("listing_offers")\n        .insert');
 const payment=s.indexOf('await prepareBuyNowPaymentIntent');
 assert.ok(global>=0&&global<own&&own<reserve&&reserve<chat&&chat<offer&&offer<payment);
 assert.match(s,/listingReserved = true/);
 assert.match(s,/if \(listingReserved\)/);
});
test("buy-now forbids stale accepted-offer payment restart",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(s,/if \(otherAccepted\?\.id\)/);
 assert.match(s,/if \(activeOffer\?\.id\)/);
 assert.match(s,/status: 409/);
});
test("CAS loser cannot invoke new chat, accepted offer or payment in the code order",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(s,/if \(error instanceof BuyNowReservationError\)/);
 assert.ok(s.indexOf('if (error instanceof BuyNowReservationError)')<
 s.indexOf('const { data: existingConversation'));
 assert.match(s,/listingReserved = true/);
 assert.doesNotMatch(s,/\.upsert\(/);
});
test("purchase success and every JSON response preserve no-store",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(s,/Cache-Control.*private, no-store/);
 assert.match(s,/privateJson\(/);
 assert.match(s,/if \(unhideError\)/);
 assert.match(s,/if \(messageError\)/);
 assert.match(s,/if \(notifyError\)/);
});
