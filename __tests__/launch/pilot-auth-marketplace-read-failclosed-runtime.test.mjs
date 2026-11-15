import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const user={id:"22222222-2222-4222-8222-222222222222"};
const seller={...user,full_name:"Synthetic Seller",user_type:"family"};
const listing={id:"33333333-3333-4333-8333-333333333333",title:"Synthetic listing",
 seller_id:user.id,status:"available",price:1,type:"sale",listing_type:"sale"};
const fail=new Error("PRIVATE_SQL_ERROR_WITH_SELLER_DETAILS");
function exercise(file,{failing,mode="listing"}){
 const calls=[];
 const dataFor=table=>{
  if(table==="favorites")return [{listing_id:listing.id}];
  if(table==="listings")return [listing];
  if(table==="listing_photos")return [{id:"photo",listing_id:listing.id,url:"synthetic://photo",sort_order:0}];
  if(table==="listing_offers")return [];
  if(table==="listing_drafts")return null;
  if(table==="profiles")return seller;
  return null;
 };
 const query=table=>{
  calls.push(table);
  const result=()=>({data: dataFor(table),error:table===failing?fail:null});
  const q=new Proxy({}, {get(_target,prop){
   if(prop==="then")return (resolve,reject)=>Promise.resolve(result()).then(resolve,reject);
   if(prop==="maybeSingle"||prop==="single")return async()=>result();
   return ()=>q;
  }});
  return q;
 };
 const supabase={auth:{getUser:async()=>({data:{user},error:null})},from:query};
 const admin={from:query};
 const mocks={
  "@/lib/supabase/server":{createClient:async()=>supabase},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/auth/server-user":{getCurrentUser:async()=>user},
  "@/lib/navbar/get-navbar-data":{getNavbarData:async()=>({isLoggedIn:true,userName:"Fixture",currentUserId:user.id})},
  "@/lib/users/get-user-profile-stats":{getUserProfileStats:async()=>({reviews:[],badgesForUserType:()=>[]})},
  "next/navigation":{
    redirect:()=>{throw Error("REDIRECT")},notFound:()=>{throw Error("NOT_FOUND")}
  },
  "@/lib/types/marketplace":{buildPhotosMap:()=>new Map()},
 };
 const input=readFileSync(file,"utf8");
 const compiled=ts.transpileModule(input,{fileName:file,reportDiagnostics:true,compilerOptions:{
   target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
   jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true
 }});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exports={};
 const imported=id=>mocks[id]??{};
 vm.runInNewContext(compiled.outputText,{exports,require:imported,console,Date,Intl,Map,Set,URL,Promise},
   {filename:file,timeout:2000});
 const args=file.includes("/profile/")?{params:Promise.resolve({id:user.id})}:undefined;
 return {run:()=>exports.default(args),calls};
}
const scenarios=[
 ["app/account/listings/page.tsx","listings","account_listings_unavailable"],
 ["app/account/listings/page.tsx","listing_drafts","account_listings_unavailable"],
 ["app/account/listings/page.tsx","listing_photos","account_listing_related_data_unavailable"],
 ["app/account/listings/page.tsx","listing_offers","account_listing_related_data_unavailable"],
 ["app/favorites/page.tsx","favorites","favorites_unavailable"],
 ["app/favorites/page.tsx","listings","favorites_listings_unavailable"],
 ["app/favorites/page.tsx","listing_photos","favorites_photos_unavailable"],
 ["app/profile/[id]/page.tsx","listings","profile_listings_unavailable"],
 ["app/profile/[id]/page.tsx","listing_photos","profile_listing_photos_unavailable"],
];
for(const [file,table,message] of scenarios){
 test(file+" rejects failed "+table+" reads without leaking backend details",async()=>{
  const {run,calls}=exercise(file,{failing:table});
  await assert.rejects(run(),e=>{
   assert.equal(e.message,message);
   assert.equal(e.message.includes("PRIVATE_SQL_ERROR"),false);
   return true;
  });
  assert.ok(calls.includes(table),table+" must actually have been queried");
 });
}
