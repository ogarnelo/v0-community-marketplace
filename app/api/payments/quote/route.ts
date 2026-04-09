import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from "@/lib/payments/pricing";

function isShipmentTier(value: unknown): value is ShipmentTier {
  return value === "none" || value === "small" || value === "medium" || value === "large";
}

function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return value === "in_person" || value === "shipping";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
    const deliveryMethod = isDeliveryMethod(body?.deliveryMethod) ? body.deliveryMethod : "shipping";
    const shipmentTier = isShipmentTier(body?.shipmentTier) ? body.shipmentTier : deliveryMethod === "shipping" ? "small" : "none";

    if (!offerId) {
      return NextResponse.json({ error: "Falta la oferta." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: offer, error } = await adminSupabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, status")
      .eq("id", offerId)
      .maybeSingle();

    if (error || !offer) {
      return NextResponse.json({ error: error?.message || "Oferta no encontrada." }, { status: 404 });
    }

    if (offer.buyer_id !== user.id) {
      return NextResponse.json({ error: "No puedes consultar esta operación." }, { status: 403 });
    }

    const itemAmount = Number(offer.accepted_amount ?? offer.current_amount ?? offer.offered_price ?? 0);
    if (!Number.isFinite(itemAmount) || itemAmount <= 0) {
      return NextResponse.json({ error: "El importe de la operación no es válido." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      quote: buildMarketplacePricing({
        itemAmount,
        deliveryMethod,
        shipmentTier,
      }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo calcular el importe total." },
      { status: 500 }
    );
  }
}
