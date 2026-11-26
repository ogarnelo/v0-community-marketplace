import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDemandOpportunity, findSupplyCandidates } from "@/lib/admin/demand-opportunities";
export const dynamic = "force-dynamic";
const headers={ "Cache-Control":"private, no-store" };
export async function GET(request:Request, context:{params:Promise<{key:string}>}){
  try{
    const supabase=await createClient(), auth=await supabase.auth.getUser();
    if(auth.error||!auth.data.user)return NextResponse.json({error:"No autenticado."},{status:401,headers});
    const role=await supabase.from("user_roles").select("role").eq("user_id",auth.data.user.id).eq("role","super_admin").limit(1);
    if(role.error)return NextResponse.json({error:"Permiso no disponible."},{status:503,headers});
    if(!role.data?.length)return NextResponse.json({error:"No autorizado."},{status:403,headers});
    const cursor=new URL(request.url).searchParams.get("cursor");
    if(!cursor||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))
      return NextResponse.json({error:"Cursor inválido."},{status:400,headers});
    const {key}=await context.params,admin=createAdminClient();
    const opportunity=await findDemandOpportunity(admin,key);
    if(!opportunity)return NextResponse.json({error:"Oportunidad no encontrada."},{status:404,headers});
    return NextResponse.json(await findSupplyCandidates(admin,opportunity,{cursor}),{headers});
  }catch{return NextResponse.json({error:"Continuación no disponible."},{status:503,headers});}
}
