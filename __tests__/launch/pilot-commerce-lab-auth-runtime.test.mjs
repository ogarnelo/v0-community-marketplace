import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const USER={id:"11111111-1111-4111-8111-111111111111"};
function h(o={}){
 const events=[],out={};
 const source=readFileSync("lib/admin/commerce-lab-access.ts","utf8");
 const c=ts.transpileModule(source,{fileName:"commerce-lab-access.ts",reportDiagnostics:true,
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 assert.equal((c.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(c.outputText,{
  exports:out,require:name=>name==="@/lib/supabase/server"?{
   createClient:async()=>{
    events.push("CLIENT");
    if(o.clientThrows)throw Error("PRIVATE_CLIENT");
    return {
     auth:{getUser:async()=>{
       events.push("AUTH");
       if(o.authThrows)throw Error("PRIVATE_AUTH");
       return {data:{user:o.guest?null:USER},error:
         o.sessionMissing?{name:"AuthSessionMissingError"}:
         o.authError?{name:"ProviderDown",message:"PRIVATE_AUTH"}:null};
     }},
     from:name=>{
       events.push("FROM:"+name);
       const q={select:()=>q,eq:()=>q,limit:async()=>({
         data:o.noRole?[]:[{role:"super_admin"}],
         error:o.roleError?{message:"PRIVATE_ROLE"}:null,
       })};
       return q;
     }
    };
   }
  }: {},Promise,Error,Date},{filename:"commerce-lab-access.ts",timeout:1700});
 return {events,run:()=>out.requireCommerceLabSuperAdmin()};
}
for(const [name,config,status] of [
 ["guest",{guest:true},401],
 ["residual user with missing session",{sessionMissing:true},401],
 ["residual user with provider error",{authError:true},503],
 ["getUser throws",{authThrows:true},503],
 ["client init throws",{clientThrows:true},503],
 ["missing superadmin role",{noRole:true},403],
 ["role query fails",{roleError:true},503]
]){
 test(name+" -> denied with no privileged context",async()=>{
   const t=h(config),result=await t.run();
   assert.equal(result.status,status);
   assert.equal(result.user,undefined);
   assert.doesNotMatch(JSON.stringify(result),/PRIVATE_/);
   if(status===401||config.authError||config.authThrows||config.clientThrows)
      assert.equal(t.events.includes("FROM:user_roles"),false);
 });
}
test("verified superadmin role allows only own user identity",async()=>{
 const t=h(),r=await t.run();
 assert.equal(r.user.id,USER.id);
 assert.equal(r.error,undefined);
 assert.deepEqual(t.events,["CLIENT","AUTH","FROM:user_roles"]);
});
const paths=[
 "app/api/admin/commerce-lab/refund/route.ts",
 "app/api/admin/commerce-lab/release-transfer/route.ts",
 "app/api/admin/commerce-lab/simulate-label/route.ts"
];
for(const path of paths){
 test(path+" gates privileged operation before admin client",()=>{
  const s=readFileSync(path,"utf8");
  assert.match(s,/isPrivateCommercePreviewEnabled/);
  assert.match(s,/requireCommerceLabSuperAdmin\(\)/);
  assert.match(s,/if \("error" in auth\)/);
  assert.ok(s.indexOf('if ("error" in auth)')<s.indexOf('const admin = createAdminClient()'));
  assert.match(s,/private, no-store/);
  assert.doesNotMatch(s,/data: \{ user \}/);
  assert.doesNotMatch(s,/error\?\.message/);
  assert.doesNotMatch(s,/return NextResponse\.json\((?!body)/);
 });
}
for(const path of paths.slice(0,2)){
 test(path+" does not initiate Stripe before a checked session",()=>{
  const s=readFileSync(path,"utf8");
  assert.ok(s.indexOf("requireCommerceLabSuperAdmin()")<
    s.indexOf("assertStripeTestMode();"));
  assert.match(s,/commerce_lab_(refund|transfer)_reconciliation_required/);
 });
}
test("simulation checks all lookups and logs only after a confirmed shipment CAS",()=>{
 const s=readFileSync(paths[2],"utf8");
 assert.match(s,/if \(shipmentLookupError\)/);
 assert.match(s,/if \(paymentLookupError\)/);
 assert.match(s,/if \(eventError\)/);
 assert.match(s,/if \(!updated\)/);
 assert.ok(s.indexOf("if (!updated)")<s.indexOf('shipment_events").insert'));
});
test("released transfer checks event persistence after Stripe transfer",()=>{
 const s=readFileSync(paths[1],"utf8");
 assert.match(s,/const \{ error: eventError \} = await admin.from\("payment_events"\).insert/);
 assert.match(s,/if \(eventError\)/);
});
