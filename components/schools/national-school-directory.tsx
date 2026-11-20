"use client";

import { useEffect, useState } from "react";
import { DIRECTORY_COMMUNITIES, SCHOOL_DIRECTORY_PAGE_SIZE } from "@/lib/schools/public-directory-search";

type Centre={
  official_code:string;name:string;school_type:string;category:string;
  municipality:string;province:string;autonomous_community:string;postal_code:string;
};
type DirectoryResponse={centres:Centre[];total:number;page:number;pageSize:number};
const OFFICIAL_CODE=/^[0-9]{8}$/;
function validResponse(value:unknown,page:number):value is DirectoryResponse {
  if(!value || typeof value!=="object")return false;
  const data=value as Record<string,unknown>;
  return data.page===page && data.pageSize===SCHOOL_DIRECTORY_PAGE_SIZE &&
    typeof data.total==="number" && Number.isSafeInteger(data.total) && data.total>=0 &&
    Array.isArray(data.centres) && data.centres.length<=SCHOOL_DIRECTORY_PAGE_SIZE &&
    data.centres.every((v:unknown)=>{
      if(!v || typeof v!=="object")return false;
      const c=v as Record<string,unknown>;
      return typeof c.official_code==="string" && OFFICIAL_CODE.test(c.official_code) &&
        ["name","municipality","province","autonomous_community","postal_code","school_type","category"]
          .every(field=>typeof c[field]==="string" && (c[field] as string).length<=240);
    });
}
export function NationalSchoolDirectory() {
  const [q,setQ]=useState("");
  const [community,setCommunity]=useState("");
  const [province,setProvince]=useState("");
  const [page,setPage]=useState(1);
  const [result,setResult]=useState<DirectoryResponse|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"unavailable">("loading");
  useEffect(()=>{
    const controller=new AbortController();
    setStatus("loading");
    setResult(null);
    // Avoid flooding requests while typing; never cache across publication changes.
    const timer=setTimeout(()=>{
      void (async()=>{
        try {
          const params=new URLSearchParams({page:String(page)});
          if(q.trim())params.set("q",q.trim());
          if(community)params.set("community",community);
          if(province.trim())params.set("province",province.trim());
          const response=await fetch("/api/school-directory?"+params.toString(),{
            signal:controller.signal,cache:"no-store",credentials:"same-origin"
          });
          if(!response.ok)throw Error("directory_unavailable");
          const payload:unknown=await response.json();
          if(!validResponse(payload,page))throw Error("directory_invalid");
          if(!controller.signal.aborted){setResult(payload);setStatus("ready");}
        }catch{
          if(!controller.signal.aborted){setResult(null);setStatus("unavailable");}
        }
      })();
    },250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[q,community,province,page]);

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
    <header className="space-y-3">
      <h1 className="text-3xl font-bold">Directorio informativo de centros educativos</h1>
      <p className="text-muted-foreground">
        Solo aparecen centros aprobados para publicación. Estar incluido no implica
        adhesión a WETUDY, verificación de su AMPA ni participación en el marketplace.
      </p>
      <p className="text-sm text-muted-foreground">
        Los datos importados requieren revisión de vigencia y de las condiciones de
        publicación antes de hacerse visibles.
      </p>
    </header>
    <section aria-label="Buscar centros" className="grid gap-3 md:grid-cols-3">
      <label className="space-y-2">
        <span className="block text-sm font-medium">Nombre, municipio, CP o código</span>
        <input type="search" value={q} maxLength={80}
          onChange={e=>{setQ(e.target.value);setPage(1);}}
          className="w-full rounded-md border bg-background px-3 py-2"
          placeholder="Buscar centro"/>
      </label>
      <label className="space-y-2">
        <span className="block text-sm font-medium">Comunidad autónoma</span>
        <select value={community}
          onChange={e=>{setCommunity(e.target.value);setProvince("");setPage(1);}}
          className="w-full rounded-md border bg-background px-3 py-2">
          <option value="">Toda España</option>
          {DIRECTORY_COMMUNITIES.map(value=><option value={value} key={value}>{value}</option>)}
        </select>
      </label>
      <label className="space-y-2">
        <span className="block text-sm font-medium">Provincia</span>
        <input value={province} maxLength={60}
          onChange={e=>{setProvince(e.target.value);setPage(1);}}
          className="w-full rounded-md border bg-background px-3 py-2" placeholder="Provincia"/>
      </label>
    </section>
    {status==="loading"&&<p role="status">Buscando centros aprobados…</p>}
    {status==="unavailable"&&
      <p role="alert" className="rounded-lg border p-4">
        No se puede consultar el directorio. Vuelve a intentarlo.
      </p>}
    {status==="ready"&&result&&<>
      <p role="status">{result.total.toLocaleString("es-ES")} centros disponibles</p>
      {result.centres.length===0&&
        <p className="rounded-lg border p-4 text-muted-foreground">
          No hay centros aprobados que coincidan con estos filtros.
        </p>}
      <ul className="space-y-3">
        {result.centres.map(centre=><li key={centre.official_code}
          className="space-y-1 rounded-lg border p-4">
          <h2 className="font-semibold">{centre.name}</h2>
          <p className="text-sm text-muted-foreground">
            {centre.municipality} · {centre.province} · {centre.autonomous_community}
          </p>
          <p className="text-xs text-muted-foreground">
            Código oficial: {centre.official_code} · CP: {centre.postal_code}
          </p>
          <p className="text-xs">Centro informativo · Adhesión a WETUDY no confirmada</p>
        </li>)}
      </ul>
      {result.total>SCHOOL_DIRECTORY_PAGE_SIZE&&<nav aria-label="Paginación del directorio"
        className="flex items-center justify-center gap-4">
        <button type="button" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}
          className="rounded-md border px-4 py-2 disabled:opacity-40">Anterior</button>
        <span>Página {page} de {Math.ceil(result.total/SCHOOL_DIRECTORY_PAGE_SIZE)}</span>
        <button type="button" disabled={page*SCHOOL_DIRECTORY_PAGE_SIZE>=result.total}
          onClick={()=>setPage(p=>Math.min(2000,p+1))}
          className="rounded-md border px-4 py-2 disabled:opacity-40">Siguiente</button>
      </nav>}
    </>}
  </main>;
}
