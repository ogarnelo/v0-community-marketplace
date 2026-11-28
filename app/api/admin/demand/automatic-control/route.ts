import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {automaticSupplyEnabled} from "@/lib/admin/automatic-supply-worker";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
async function actor(){
 const db=await createClient();
 const {data,error}=await db.auth.getUser();
 if(error||!data.user)return null;
 const roles=await db.from("user_roles").select("role").eq("user_id",data.user.id).eq("role","super_admin").limit(1);
 if(roles.error)throw Error("authority_unavailable");
 return roles.data?.length?data.user.id:null;
}
export async function GET(){
 try{
  if(!await actor())return reply({error:"unauthorized"},403);
  if(process.env.WETUDY_AUTOMATIC_SUPPLY_ENABLED!=="true")return reply({available:false,enabled:false});
  return reply({available:true,enabled:await automaticSupplyEnabled(createAdminClient())});
 }catch{return reply({error:"control_unavailable"},503);}
}
export async function PUT(request:Request){
 try{
  const id=await actor();if(!id)return reply({error:"unauthorized"},403);
  if(process.env.WETUDY_AUTOMATIC_SUPPLY_ENABLED!=="true")return reply({error:"disabled"},409);
  const body=await request.json().catch(()=>null);
  if(typeof body?.enabled!=="boolean")return reply({error:"invalid_request"},400);
  const {data,error}=await createAdminClient().rpc("set_automatic_supply_enabled_v1",{p_actor:id,p_enabled:body.enabled});
  if(error||typeof data!=="boolean")throw Error("control_unavailable");
  return reply({available:true,enabled:data});
 }catch{return reply({error:"control_unavailable"},503);}
}
