import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const ts=require("typescript"),React=require("react"),server=require("react-dom/server");
const source=readFileSync("components/admin/federation-kpi-dashboard.tsx","utf8");
const compiled=ts.transpileModule(source,{
 fileName:"federation-kpi-dashboard.tsx",
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
 reportDiagnostics:true,
});
assert.equal((compiled.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const module={exports:{}};
vm.runInNewContext(compiled.outputText,{module,exports:module.exports,require,
  Intl,Set,Error},{filename:"dashboard.cjs",timeout:1500});
const id="11111111-1111-4111-8111-111111111111";
const total=[
 {key:"reusedItems",title:"Artículos reutilizados",value:3,unit:"count"},
 {key:"donatedItems",title:"Donaciones",value:1,unit:"count"},
 {key:"soldItems",title:"Compraventas",value:2,unit:"count"},
 {key:"circularValue",title:"Valor circular",value:20,unit:"eur"},
 {key:"estimatedAvoidedCo2",title:"CO₂ evitado (estimado)",value:7.2,unit:"kg"},
 {key:"activeListings",title:"Anuncios activos",value:3,unit:"count"},
 {key:"listingViews",title:"Visualizaciones",value:20,unit:"count"},
];
const model=(over={})=>({
 organization:"FAMPA ficticia",period:"365d",periodLabel:"Últimos 365 días",
 start:"2025-11-17T12:00:00Z",end:"2026-11-17T12:00:00Z",
 schools:[{id,name:"Colegio ficticio",suppressed:false,metrics:total}],
 total,totalSuppressed:false,...over,
});
const render=props=>server.renderToStaticMarkup(
 React.createElement(module.exports.FederationKpiDashboard,{model:props}),
);
test("renders all seven KPI with euro and CO2 units and only authorized school names",()=>{
 const html=render(model());
 assert.match(html,/Impacto de las AMPAs representadas/);
 assert.match(html,/FAMPA ficticia/);
 assert.match(html,/Colegio ficticio/);
 assert.match(html,/Valor circular/);
 assert.match(html,/20,00/);
 assert.match(html,/CO₂ evitado/);
 assert.match(html,/Filtrar por colegio/);
 assert.doesNotMatch(html,/service_role|email|auth\.users|PRIVATE/);
});
test("small-cell privacy never renders suppressed school's sensitive figures",()=>{
 const html=render(model({
  total:null,totalSuppressed:true,
  schools:[{id,name:"Colegio protegido",metrics:null,suppressed:true}],
 }));
 assert.match(html,/Total protegido por confidencialidad/);
 assert.match(html,/Indicadores protegidos por confidencialidad/);
 assert.doesNotMatch(html,/20,00|7,2 kg|3<\/dd>/);
});
test("period switch stays disabled without a protected caller and no fake client data reload",()=>{
 const html=render(model());
 assert.match(html,/<select[^>]*aria-label="Filtrar por periodo"[^>]*disabled=""/);
 assert.match(html,/conectar la consulta autorizada/);
 assert.doesNotMatch(source,/fetch\s*\(|createClient\s*\(|supabase\.from\s*\(/);
});
test("dashboard exposes no buttons for changing AMPA operations",()=>{
 const html=render(model());
 assert.doesNotMatch(html,/<button\b|name="user_role"|Eliminar|Aprobar donación/);
 assert.match(html,/Solo lectura/);
});
