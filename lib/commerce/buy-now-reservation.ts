import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A single guarded PostgREST UPDATE is atomic for competing requests
 * through the buy-now route. It is NOT a cross-table checkout transaction.
 */
export class BuyNowReservationError extends Error {
  constructor(public readonly status: 409 | 503, public readonly publicMessage: string) {
    super(publicMessage);
    this.name = "BuyNowReservationError";
  }
}

export async function reserveAvailableListing(params: {
  admin: SupabaseClient;
  listingId: string;
}): Promise<string> {
  const { admin, listingId } = params;
  const { data: changed, error } = await admin.from("listings")
    .update({ status: "reserved" })
    .eq("id", listingId)
    .eq("status", "available")
    .select("id")
    .maybeSingle();

  if (error) throw new BuyNowReservationError(503, "No se pudo reservar el anuncio.");
  if (!changed?.id) {
    throw new BuyNowReservationError(409, "El anuncio ya no está disponible. Actualiza la página.");
  }
  return changed.id;
}
