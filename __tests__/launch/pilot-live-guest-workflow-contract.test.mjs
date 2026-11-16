import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const yml=readFileSync(".github/workflows/pilot-live-guest-http-contract.yml","utf8");
const js=readFileSync("scripts/pilot-guest-http-smoke.mjs","utf8");
test("workflow permite ejecución manual sin token ni Node local del fundador",()=>{
 assert.match(yml,/workflow_dispatch:/);
 assert.match(yml,/actions\/setup-node@v4/);
 assert.match(yml,/node-version: "22"/);
 assert.match(yml,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(yml,/secrets\.|VERCEL_TOKEN|SUPABASE_SERVICE_ROLE_KEY|workflow_run:/);
});
test("solo ocurre en cambios de la API productiva o ejecución manual, nunca en pull_request",()=>{
 assert.match(yml,/push:\s*\n\s*branches:\s*\n\s*- main/);
 for(const p of ["my-school","listing-draft"]){
  assert.ok(yml.includes('app/api/marketplace/'+p+'/route.ts'));
 }
 assert.ok(yml.includes('app/api/messages/conversation-summary/route.ts'));
 assert.ok(yml.includes('scripts/pilot-guest-http-smoke.mjs'));
 assert.doesNotMatch(yml,/^\s*pull_request:/m);
});
test("workflow no usa endpoints de escritura ni despliega",()=>{
 assert.match(yml,/node scripts\/pilot-guest-http-smoke\.mjs https:\/\/www\.wetudy\.com/);
 assert.doesNotMatch(yml,/vercel deploy|vercel promote|supabase db|curl.*-X POST|HTTP_METHOD=/);
 assert.match(js,/method:"GET"/);
 assert.match(js,/redirect:"manual"/);
 assert.match(js,/cache:"no-store"/);
});
test("el código de error del verificador llega al estado de CI aunque se emita un resumen",()=>{
 assert.match(yml,/result=\$\?/);
 assert.match(yml,/GITHUB_STEP_SUMMARY/);
 assert.match(yml,/exit "\$result"/);
 assert.match(js,/process\.exitCode=1/);
});
test("limita la evaluación de visitantes a los tres endpoints y no lo confunde con E2E autenticado",()=>{
 assert.equal((js.match(/\["(?:Mi colegio|Borradores|Resumen de conversación)"/g)||[]).length,3);
 assert.match(yml,/No valida sesiones reales, DR ni AMPA/);
 assert.match(js,/CONTRATO HTTP INVITADO: 3\/3 CONFIRMADO/);
});
