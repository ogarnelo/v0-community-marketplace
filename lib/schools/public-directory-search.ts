export const SCHOOL_DIRECTORY_PAGE_SIZE = 24;
export const DIRECTORY_COMMUNITIES = [
  "Andalucía", "Aragón", "Principado de Asturias", "Illes Balears",
  "Canarias", "Cantabria", "Castilla y León", "Castilla-La Mancha",
  "Cataluña", "Comunitat Valenciana", "Extremadura", "Galicia",
  "Comunidad de Madrid", "Región de Murcia", "Comunidad Foral de Navarra",
  "País Vasco", "La Rioja", "Ceuta", "Melilla",
] as const;

export function getDirectorySearch(params: URLSearchParams):
 | {ok:true; community:string|null; province:string|null; page:number; pattern:string|null}
 | {ok:false; error:string} {
  const query=(params.get("q")||"").trim();
  const community=(params.get("community")||"").trim();
  const province=(params.get("province")||"").trim();
  const page=(params.get("page")||"1").trim();
  if(query.length>80 || /[\x00-\x1f\x7f]/.test(query))
    return {ok:false,error:"Búsqueda no válida."};
  if(community && !DIRECTORY_COMMUNITIES.some(v=>v===community))
    return {ok:false,error:"Comunidad autónoma no válida."};
  if(province && (province.length>60 || !/^[\p{L} .()/-]{2,60}$/u.test(province)))
    return {ok:false,error:"Provincia no válida."};
  if(!/^[1-9][0-9]{0,3}$/.test(page) || Number(page)>2000)
    return {ok:false,error:"Página no válida."};
  // Escape LIKE wildcards; query is always bound by PostgREST, never SQL text.
  const pattern=query?("%"+query.replace(/[\\%_]/g,"\\$&")+"%"):null;
  return {ok:true,community:community||null,province:province||null,
    page:Number(page),pattern};
}
