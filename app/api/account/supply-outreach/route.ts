import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
async function session(){
  const db=await createClient(),{data,error}=await db.auth.getUser();
  return error||!data?.user?null:{db,id:data.user.id};
}
export async function GET(){
  const actor=await session();
  if(!actor)return NextResponse.json({error:"No autenticado."},{status:401,headers});
  const {data,error}=await actor.db.from("user_marketplace_preferences").select("supply_outreach_opt_in").eq("user_id",actor.id).maybeSingle();
  if(error)return NextResponse.json({error:"Permiso aún no disponible."},{status:503,headers});
  return NextResponse.json({enabled:data?.supply_outreach_opt_in===true},{headers});
}
export async function PUT(request:Request){
  const actor=await session();
  if(!actor)return NextResponse.json({error:"No autenticado."},{status:401,headers});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body.enabled!=="boolean")return NextResponse.json({error:"Consentimiento inválido."},{status:400,headers});
  const {error}=await actor.db.from("user_marketplace_preferences")
    .upsert({user_id:actor.id,supply_outreach_opt_in:body.enabled},{onConflict:"user_id"});
  if(error)return NextResponse.json({error:"No se pudo guardar el permiso."},{status:503,headers});
  return NextResponse.json({enabled:body.enabled},{headers});
}
