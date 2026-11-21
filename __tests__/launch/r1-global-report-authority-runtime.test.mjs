import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const user={id:'11111111-1111-4111-8111-111111111111',email:'admin@example.invalid',email_confirmed_at:'2026-11-01'};
const sub={id:'22222222-2222-4222-8222-222222222222',user_id:user.id,email:user.email,frequency_days:7,report_range:'30d',report_format:'pdf',next_send_at:'2026-11-01T00:00:00Z'};
function harness(kind,opts={}){
 const calls=[]; let roleReads=0,authReads=0,subscriptionReads=0;
 const path=kind==='cron'?'app/api/cron/super-admin-reports/route.ts':kind==='export'?'app/api/admin/super/report/route.ts':'app/api/admin/super/report-subscription/route.ts';
 let claimed=false;
 const client={
 rpc:async(name,args)=>{
  calls.push(name);
  if(name==='r1_global_report_claim'){
   assert.equal(args.p_subscription_id,sub.id);
   if(opts.claimError)return {error:{message:'PRIVATE'},data:null};
   if(opts.claimLost||claimed)return {error:null,data:null};
   claimed=true;
   return {error:null,data:'33333333-3333-4333-8333-333333333333'};
  }
  assert.equal(name,'r1_global_report_ack');
  assert.equal(args.p_claim_id,'33333333-3333-4333-8333-333333333333');
  return {error:null,data:!opts.ackLost};
 },
 auth:{getUser:async()=>({data:{user:([2,3].includes(++authReads)&&opts.changedEmail||authReads===3&&opts.postClaimEmail)?{...user,email:'changed@example.invalid'}:user},error:null}),
 admin:{getUserById:async()=>({data:{user:([2,3].includes(++authReads)&&opts.changedEmail||authReads===3&&opts.postClaimEmail)?{...user,email:'changed@example.invalid'}:user},error:opts.authError?{message:'PRIVATE'}:null})}},
 from(table){
  let writing=false;
  const q={select:()=>q,eq:()=>q,limit:()=>q,lte:()=>q,returns:()=>q,
  update:()=>{writing=true;calls.push('settle');return q;},
  upsert:()=>{writing=true;calls.push('write');return q;},
  maybeSingle:async()=>writing?{data:opts.noSettlement?null:{id:sub.id},error:null}:{data:++subscriptionReads===2&&opts.changedSub?null:{id:sub.id},error:null},
  then(resolve,reject){
   const result=table==='user_roles'?{data:(++roleReads===2&&opts.revoked)||opts.noRole?[]:[{role:'super_admin'}],error:null}: {data:writing?null:[sub],error:null};
   return Promise.resolve(result).then(resolve,reject);
  }};return q;
 }};
 const modules={
 'next/server':{NextResponse:{json:(b,o)=>Response.json(b,o)}},
 '@/lib/supabase/server':{createClient:async()=>client},
 '@/lib/supabase/admin':{createAdminClient:()=>{calls.push('admin');return client;}},
 '@/lib/reports/super-admin-report':{normalizeSuperAdminRange:()=> '30d',loadSuperAdminReport:async()=>{calls.push('load');return {};},renderSuperAdminCsv:()=>{calls.push('render');return 'synthetic';},renderSuperAdminPdf:()=>new Uint8Array([1])},
 '@/lib/emails/super-admin-report-email':{sendSuperAdminReportEmail:async()=>{calls.push('send');return opts.skipped?{skipped:true}:opts.noId?{}:{id:'synthetic-provider-id'};}}
 };
 const compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
 assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const exports={};vm.runInNewContext(compiled.outputText,{exports,require:n=>{assert.ok(modules[n],n);return modules[n];},Request,Response,URL,Date,Promise,process:{env:{CRON_SECRET:'synthetic',WETUDY_SUPER_ADMIN_REPORT_EMAIL_ENABLED:opts.paused?'false':'true'}},console:{error(){}}});
 const request=new Request('https://synthetic.invalid/report?format=csv',{method:kind==='subscription'?'POST':'GET',headers:{authorization:'Bearer synthetic','content-type':'application/json'},...(kind==='subscription'?{body:JSON.stringify(opts.body??{enabled:true,email:user.email,frequencyDays:7})}:{})});
 return {calls,run:()=>exports[kind==='subscription'?'POST':'GET'](request)};
}
for(const [kind,opts,status,forbidden] of [
 ['export',{revoked:true},403,'render'],
 ['export',{},200,null],
 ['subscription',{body:{enabled:true,email:'other@example.invalid'}},403,'write'],
 ['subscription',{changedEmail:true},403,'write'],
 ['subscription',{revoked:true},403,'write'],
 ['subscription',{body:{}},400,'write'],
 ['subscription',{},200,null],
 ['cron',{paused:true},200,'admin'],
 ['cron',{noRole:true},200,'send'],
 ['cron',{authError:true},503,'send'],
 ['cron',{revoked:true},200,'send'],
 ['cron',{changedEmail:true},200,'send'],
 ['cron',{changedSub:true},200,'send'],
 ['cron',{claimError:true},503,'send'],
 ['cron',{claimLost:true},200,'send'],
 ['cron',{postClaimEmail:true},200,'send'],
 ['cron',{ackLost:true},503,'settle'],
 ['cron',{skipped:true},503,'settle'],
 ['cron',{noId:true},503,'settle'],
 ['cron',{noSettlement:true},503,null],
 ['cron',{},200,null],
]){
 test(kind+' '+JSON.stringify(opts),async()=>{
  const h=harness(kind,opts);const r=await h.run();assert.equal(r.status,status);
  if(forbidden)assert.ok(!h.calls.includes(forbidden),h.calls.join(','));
  if(kind==='cron'){const b=await r.json();assert.equal(b.sent??0, !Object.keys(opts).length?1:0);}
  if(kind==='subscription'&&!Object.keys(opts).length)assert.ok(h.calls.includes('write'));
  if(kind==='export'&&!Object.keys(opts).length)assert.ok(h.calls.includes('render'));
 });
}

test('concurrent cron attempts share one durable claim in mocked DB',async()=>{
 const h=harness('cron');
 const results=await Promise.all([h.run(),h.run()]);
 assert.equal(results.filter(r=>r.status===200).length,2);
 assert.equal(h.calls.filter(x=>x==='send').length,1);
 assert.ok(h.calls.indexOf('r1_global_report_claim')<h.calls.indexOf('send'));
 assert.ok(h.calls.indexOf('r1_global_report_ack')<h.calls.indexOf('settle'));
});
