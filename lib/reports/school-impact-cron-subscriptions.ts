import type { SupabaseClient } from "@supabase/supabase-js";

/** Only the existing authenticated server cron may invoke this privileged read. */
export type DueSchoolImpactSubscription = {
  id:string;
  school_id:string;
  user_id:string;
  email:string;
  day_of_month:number;
  last_sent_month:string|null;
};

/**
 * The PostgREST default row cap silently truncates unpaged subscription reads.
 * Scan the FULL due-day set before delivering ANY email. If pagination,
 * count or ordering is uncertain, fail without sending a partial batch.
 *
 * Count fences are not a transaction-wide snapshot and cannot stop two
 * concurrent cron invocations from sending the same subscription.
 */
export async function loadDueSchoolImpactSubscriptions(
  admin: SupabaseClient, day: number,
):Promise<DueSchoolImpactSubscription[]> {
  if (!Number.isInteger(day) || day < 1 || day > 28)
    throw new Error("SCHOOL_REPORT_INVALID_CRON_DAY");

  const maxRows=5000, pageSize=250;
  async function exactCount():Promise<number> {
    const {count,error}=await admin
      .from("school_impact_report_subscriptions")
      .select("id",{count:"exact",head:true})
      .eq("enabled",true)
      .eq("day_of_month",day);
    if(error) throw new Error("SCHOOL_REPORT_SUBSCRIPTIONS_UNAVAILABLE");
    if(!Number.isSafeInteger(count)||count<0||count>maxRows)
      throw new Error("SCHOOL_REPORT_SUBSCRIPTIONS_UNAVAILABLE");
    return count;
  }

  const initialCount=await exactCount();
  const rows:DueSchoolImpactSubscription[]=[];
  let afterId:string|null=null;
  for(let p=0;p<=maxRows/pageSize;p++){
    let query=admin
      .from("school_impact_report_subscriptions")
      .select("id, school_id, user_id, email, day_of_month, last_sent_month")
      .eq("enabled",true)
      .eq("day_of_month",day);
    if(afterId)query=query.gt("id",afterId);
    const {data,error}=await query
      .order("id",{ascending:true})
      .limit(pageSize)
      .returns<DueSchoolImpactSubscription[]>();
    if(error||!Array.isArray(data))throw new Error("SCHOOL_REPORT_SUBSCRIPTIONS_UNAVAILABLE");
    if(data.length>pageSize||rows.length+data.length>maxRows)
      throw new Error("SCHOOL_REPORT_SUBSCRIPTIONS_INCOMPLETE");
    for(const row of data){
      if(!row?.id||typeof row.id!=="string"||
          afterId!==null&&row.id<=afterId||
          row.day_of_month!==day||!row.user_id||!row.school_id||
          typeof row.email!=="string")
        throw new Error("SCHOOL_REPORT_SUBSCRIPTIONS_INCOMPLETE");
      afterId=row.id;
      rows.push(row);
    }
    if(data.length<pageSize)break;
    if(p===maxRows/pageSize)throw new Error("SCHOOL_REPORT_SUBSCRIPTIONS_INCOMPLETE");
  }
  const finalCount=await exactCount();
  if(finalCount!==initialCount||rows.length!==finalCount)
    throw new Error("SCHOOL_REPORT_SUBSCRIPTIONS_INCOMPLETE");
  return rows;
}
