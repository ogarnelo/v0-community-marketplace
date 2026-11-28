"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
export function AutomaticSupplyControl(){
 const [state,setState]=useState<{available:boolean;enabled:boolean}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false);
 async function refresh(){
  try{const res=await fetch("/api/admin/demand/automatic-control",{cache:"no-store"});
   if(!res.ok)throw Error();setState(await res.json());setError(false);
  }catch{setState(null);setError(true);}
 }
 useEffect(()=>{void refresh()},[]);
 async function toggle(){
  if(!state?.available||busy)return;setBusy(true);
  try{const res=await fetch("/api/admin/demand/automatic-control",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:!state.enabled})});
   if(!res.ok)throw Error();setState(await res.json());setError(false);
  }catch{setState(null);setError(true);}finally{setBusy(false);}
 }
 return <section className="rounded-xl border p-4 space-y-2">
  <p className="font-semibold">Demanda inteligente automática</p>
  <p className="text-sm text-muted-foreground">{state?.available?(state.enabled?"Activada":"En pausa"):"No habilitada para el piloto"}. Solo avisos internos, respetando preferencias individuales.</p>
  <Button type="button" disabled={!state?.available||busy} onClick={()=>void toggle()}>{busy?"Guardando...":state?.enabled?"Pausar automatización":"Activar automatización"}</Button>
  {error?<p role="alert">No se pudo confirmar el estado. <Button variant="outline" onClick={()=>void refresh()}>Reintentar</Button></p>:null}
 </section>;
}
