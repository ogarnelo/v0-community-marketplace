import "server-only";
// Explicit deployment switch, independent of account type or school.
export function pilotSupplyDefault(flag: string | undefined): boolean {
  return flag === "true";
}
// Insert only: a previous explicit opt-out must never be overwritten.
export async function initializePilotSupplyPreference(db: {from: (table:string)=>any}, user: {id:string;user_metadata?:Record<string,unknown>}, flag: string | undefined) {
  const choice=user.user_metadata?.wetudy_supply_notice_initial;
  if(choice!==false && !pilotSupplyDefault(flag))return;
  const {error}=await db.from("user_marketplace_preferences").upsert(
    {user_id:user.id,supply_outreach_opt_in:choice===false?false:true},
    {onConflict:"user_id",ignoreDuplicates:true}
  );
  if(error)throw error;
}
