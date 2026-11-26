"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
export function SupplyOutreachConsent(){
  const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let live=true;fetch("/api/account/supply-outreach",{cache:"no-store"})
    .then(async res=>{const json=await res.json();if(!res.ok)throw Error(json.error);return json;})
    .then(data=>{if(live){setEnabled(data.enabled===true);setReady(true);}})
    .catch(e=>{if(live)setError(e.message||"Permiso no disponible.");});
    return()=>{live=false;};},[]);
  const save=async(value:boolean)=>{if(!ready||saving)return;setSaving(true);setError("");
    try{const response=await fetch("/api/account/supply-outreach",{method:"PUT",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({enabled:value})});const data=await response.json();
      if(!response.ok)throw Error(data.error);setEnabled(data.enabled===true);
    }catch(e:any){setError(e.message||"Error al guardar.");}finally{setSaving(false);}
  };
  return <section className="space-y-4 rounded-xl border p-5">
    <p className="font-medium">{enabled?"Permiso activado":"Permiso desactivado (por defecto)"}</p>
    <p className="text-sm text-muted-foreground">Puedes permitir que WETUDY te avise dentro de la aplicación
      cuando otras familias busquen material que quizá tengas según el contexto educativo de tu cuenta.
      No significa que tengas ningún producto. No genera emails ni avisos automáticos.
      Puedes revocar este permiso cuando quieras.</p>
    <Button type="button" disabled={!ready||saving} onClick={()=>void save(!enabled)}>
      {saving?"Guardando...":enabled?"Revocar permiso":"Autorizar avisos"}
    </Button>
    {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
  </section>;
}
