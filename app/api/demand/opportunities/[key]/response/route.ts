import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: {status?:number} = {}) {
  return NextResponse.json(body,{...options,headers:PRIVATE_HEADERS});
}
const KEY_RE = /^opp_[a-f0-9]{24}$/;

export async function POST(request: Request,context:{params:Promise<{key:string}>}) {
  try {
    const supabase=await createClient();
    const {data:authData,error:authError}=await supabase.auth.getUser();
    if(authError){
      const absent=authError.name==="AuthSessionMissingError"||authError.code==="session_not_found";
      return privateJson({error:absent?"No autenticado.":"No se pudo comprobar tu sesión."},
        {status:absent?401:503});
    }
    const user=authData?.user??null;
    if(!user)return privateJson({error:"No autenticado."},{status:401});
    const {key}=await context.params;
    if(typeof key!=="string"||!KEY_RE.test(key))
      return privateJson({error:"Oportunidad no válida."},{status:400});
    const body=await request.json().catch(()=>({}));
    const response=body?.response;
    if(response!=="have_one"&&response!=="dont_have")
      return privateJson({error:"Respuesta no válida."},{status:400});
    const admin=createAdminClient();
    const {data:action,error:lookupError}=await admin.from("demand_opportunity_actions")
      .select("id,response,responded_at").eq("opportunity_key",key)
      .eq("target_user_id",user.id).eq("action_type","seller_contacted")
      .order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(lookupError)return privateJson({error:"No se pudo verificar la activación."},{status:503});
    if(!action)return privateJson({error:"Activación no encontrada."},{status:404});
    const publishHref=response==="have_one"
      ?`/marketplace/new?opportunity=${encodeURIComponent(key)}`:null;
    if(action.responded_at!==null&&action.responded_at!==undefined){
      if(action.response===response)return privateJson({ok:true,publishHref,alreadyExists:true});
      return privateJson({error:"Ya hay una respuesta registrada para esta activación."},{status:409});
    }
    const {data:changed,error:updateError}=await admin.from("demand_opportunity_actions")
      .update({responded_at:new Date().toISOString(),response})
      .eq("id",action.id).eq("target_user_id",user.id)
      .eq("action_type","seller_contacted").is("responded_at",null)
      .select("id").maybeSingle();
    if(updateError)return privateJson({error:"No se pudo guardar la respuesta."},{status:503});
    if(!changed)return privateJson({error:"La respuesta ha cambiado. Actualiza la página."},{status:409});
    return privateJson({ok:true,publishHref});
  }catch{
    console.error("demand_opportunity_response_failed");
    return privateJson({error:"No se pudo guardar la respuesta."},{status:500});
  }
}
