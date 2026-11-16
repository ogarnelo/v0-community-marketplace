#!/usr/bin/env node
// Read-only guest HTTP smoke. Sends no cookies or Authorization headers.
import { pathToFileURL } from "node:url";

export const GUEST_ENDPOINTS = Object.freeze([
  ["Mi colegio", "/api/marketplace/my-school"],
  ["Borradores", "/api/marketplace/listing-draft"],
  ["Resumen de conversación", "/api/messages/conversation-summary?conversation_id=11111111-1111-4111-8111-111111111111"],
]);

export function validatedOrigin(value) {
  const u = new URL(value);
  if ((u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost","127.0.0.1"].includes(u.hostname))) ||
      u.username || u.password || u.pathname !== "/" || u.search || u.hash) {
    throw new Error("La base debe ser un origen HTTPS válido (HTTP solo localhost).");
  }
  return u.origin;
}

export async function verifyGuestHttp({baseUrl = "https://www.wetudy.com", fetcher = fetch} = {}) {
  const origin = validatedOrigin(baseUrl);
  const outcomes = [];
  for(const [label,path] of GUEST_ENDPOINTS){
    let response;
    try {
      // Never follow login/Access redirects; the application response is the evidence.
      response = await fetcher(origin+path, {
        method:"GET", redirect:"manual", cache:"no-store",
        headers:{"Accept":"application/json"}, signal:AbortSignal.timeout(15000)
      });
    } catch {
      outcomes.push({label,path,state:"INCONCLUSO",status:null,reason:"La solicitud no llegó a una respuesta HTTP verificable"});
      continue;
    }
    const status=response.status;
    if (status>=300 && status<400){
      outcomes.push({label,path,state:"INCONCLUSO",status,reason:"Redirección externa o protección previa a la aplicación"});
      continue;
    }
    const contentType=response.headers.get("content-type") || "";
    if(!contentType.toLowerCase().includes("application/json")) {
      outcomes.push({label,path,state:"INCONCLUSO",status,reason:"Respuesta no JSON; posible control de acceso intermedio"});
      continue;
    }
    if(status!==401){
      outcomes.push({label,path,state:"FALLO",status,reason:"Se esperaba HTTP 401 de la aplicación"});
      continue;
    }
    const cache=response.headers.get("cache-control") || "";
    if(!/private/i.test(cache)||!/no-store/i.test(cache)){
      outcomes.push({label,path,state:"FALLO",status,reason:"Falta Cache-Control: private, no-store"});
      continue;
    }
    let body;
    try{ body=await response.json(); }catch{
      outcomes.push({label,path,state:"FALLO",status,reason:"El cuerpo no es JSON válido"});
      continue;
    }
    if(!body||typeof body!=="object"||typeof body.error!=="string"||
       Object.keys(body).some(k=>k!=="error")){
      outcomes.push({label,path,state:"FALLO",status,reason:"La respuesta de invitado incluye estructura inesperada"});
      continue;
    }
    outcomes.push({label,path,state:"OK",status,reason:"HTTP 401 de API, JSON de error privado no-cache"});
  }
  return outcomes;
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
  const base=process.argv[2] || "https://www.wetudy.com";
  verifyGuestHttp({baseUrl:base}).then(outcomes=>{
    for(const o of outcomes){
      console.log(o.state+" | "+o.label+" | "+(o.status??"sin HTTP")+" | "+o.reason);
    }
    if(outcomes.every(o=>o.state==="OK")){
      console.log("CONTRATO HTTP INVITADO: 3/3 CONFIRMADO");
    }else{
      console.log("CONTRATO HTTP INVITADO: NO CERTIFICADO (revisar resultados)");
      process.exitCode=1;
    }
  }).catch(()=>{
    console.error("ERROR: origen inválido o imposibilidad de ejecutar comprobación");
    process.exitCode=2;
  });
}
