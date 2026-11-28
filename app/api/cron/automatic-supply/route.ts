import {createAdminClient} from "@/lib/supabase/admin";
import {runAutomaticSupply} from "@/lib/admin/automatic-supply-worker";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get("authorization")!==`Bearer ${secret}`)
  return Response.json({error:"unauthorized"},{status:401,headers});
 if(process.env.WETUDY_AUTOMATIC_SUPPLY_ENABLED!=="true")
  return Response.json({status:"disabled",sent:0},{headers});
 try{return Response.json(await runAutomaticSupply(createAdminClient()),{headers});}
 catch{console.error("automatic_supply_run_failed");return Response.json({error:"automatic_supply_unavailable"},{status:503,headers});}
}
