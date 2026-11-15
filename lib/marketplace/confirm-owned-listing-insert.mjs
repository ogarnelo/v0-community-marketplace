/**
 * A POST/INSERT may commit before the HTTP client receives its response.
 * Reconcile only through the authenticated seller's RLS-visible row and the
 * same caller-generated UUID; never use the service role here.
 *
 * @param {{
 * listingId:string,
 * sellerId:string,
 * insert:()=>Promise<{error?:unknown}|null>,
 * lookupOwned:()=>Promise<{data?:{id?:string,seller_id?:string|null}|null,error?:unknown}>
 * }} args
 * @returns {Promise<"inserted"|"recovered">}
 */
export async function confirmOwnedListingInsert({listingId,sellerId,insert,lookupOwned}) {
  if (!listingId || !sellerId) throw new Error("listing_insert_unconfirmed");
  let failed = false;
  try {
    const result = await insert();
    failed = Boolean(!result || result.error);
  } catch {
    failed = true;
  }
  if (!failed) return "inserted";

  try {
    const result = await lookupOwned();
    if (!result?.error && result?.data?.id === listingId &&
        result?.data?.seller_id === sellerId) {
      return "recovered";
    }
  } catch {
    // Still unknown, but caller must reuse this same UUID on a future retry.
  }
  throw new Error("listing_insert_unconfirmed");
}
