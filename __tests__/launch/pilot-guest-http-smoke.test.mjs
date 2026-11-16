import test from "node:test";
import assert from "node:assert/strict";
import {verifyGuestHttp,validatedOrigin,GUEST_ENDPOINTS} from "../../scripts/pilot-guest-http-smoke.mjs";

const make=(status=401,headers={"cache-control":"private, no-store","content-type":"application/json"},
  body={error:"No autenticado."})=>({
   status,
   headers:{get:k=>headers[k.toLowerCase()]||null},
   json:async()=>body,
});
test("mantiene exactamente tres GET públicos sin cookie, auth header ni redirects",async()=>{
 const seen=[];
 const results=await verifyGuestHttp({fetcher:async(url,options)=>{
  seen.push({url,options});return make();
 }});
 assert.deepEqual(results.map(r=>r.state),["OK","OK","OK"]);
 assert.equal(seen.length,GUEST_ENDPOINTS.length);
 for(const {url,options} of seen){
  assert.ok(url.startsWith("https://www.wetudy.com/api/"));
  assert.equal(options.method,"GET");
  assert.equal(options.redirect,"manual");
  assert.equal(options.cache,"no-store");
  assert.equal(Object.keys(options.headers).some(k=>/cookie|auth|token/i.test(k)),false);
 }
});
test("no atribuye 200 a invitado certificado",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>make(200)});
 assert.equal(r.every(x=>x.state==="FALLO"),true);
});
test("no confunde un 503 real con 401",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>make(503)});
 assert.equal(r.every(x=>x.state==="FALLO"),true);
});
test("no confunde HTML de Vercel Access con el 401 de la app",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>make(401,{"content-type":"text/html"})});
 assert.equal(r.every(x=>x.state==="INCONCLUSO"),true);
});
test("no sigue redirecciones a pantallas de login",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>make(302)});
 assert.equal(r.every(x=>x.state==="INCONCLUSO"),true);
});
test("falla si la respuesta permite caché privada sensible",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>make(401,{"content-type":"application/json","cache-control":"public, max-age=300"})});
 assert.equal(r.every(x=>x.state==="FALLO"),true);
});
test("falla si JSON 401 contiene payload adicional",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>make(401,undefined,{error:"sin sesión",listings:[{id:"secret"}]})});
 assert.equal(r.every(x=>x.state==="FALLO"),true);
});
test("falla si falta JSON error string",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>make(401,undefined,{message:"error"})});
 assert.equal(r.every(x=>x.state==="FALLO"),true);
});
test("un fallo de red no se interpreta como prueba superada",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>{throw Error("network fail");}});
 assert.equal(r.every(x=>x.state==="INCONCLUSO"),true);
});
test("rechaza URL externa HTTP y rutas anexas",()=>{
 assert.throws(()=>validatedOrigin("http://www.wetudy.com"));
 assert.throws(()=>validatedOrigin("https://www.wetudy.com/path"));
 assert.throws(()=>validatedOrigin("https://alice:pw@www.wetudy.com/"));
 assert.equal(validatedOrigin("http://localhost:3000/"),"http://localhost:3000");
});
test("acepta la cabecera no-store con max-age=0",async()=>{
 const r=await verifyGuestHttp({fetcher:async()=>make(401,{"content-type":"application/json","cache-control":"private, no-store, max-age=0"})});
 assert.equal(r.every(x=>x.state==="OK"),true);
});
