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
  expectedSellerId: string;
  expectedPrice: number;
}): Promise<string> {
  const { admin, listingId, expectedSellerId, expectedPrice } = params;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const priceCents = Math.round(expectedPrice * 100);
  if (!uuid.test(listingId) || !uuid.test(expectedSellerId) ||
      !Number.isFinite(expectedPrice) || expectedPrice <= 0 ||
      !Number.isSafeInteger(priceCents) ||
      Math.abs(expectedPrice * 100 - priceCents) > 1e-6) {
    throw new BuyNowReservationError(503, "No se pudieron validar las condiciones del anuncio.");
  }

  // Price and seller are part of the same atomic UPDATE predicate as status.
  // A seller changing the offer after the initial GET makes this CAS lose,
  // without creating a conversation, accepted offer or payment intent.
  const { data: changed, error } = await admin.from("listings")
    .update({ status: "reserved" })
    .eq("id", listingId)
    .eq("status", "available")
    .eq("seller_id", expectedSellerId)
    .eq("price", expectedPrice)
    .select("id")
    .maybeSingle();

  if (error) throw new BuyNowReservationError(503, "No se pudo reservar el anuncio.");
  if (!changed?.id) {
    throw new BuyNowReservationError(409, "El anuncio ya no está disponible. Actualiza la página.");
  }
  return changed.id;
}
