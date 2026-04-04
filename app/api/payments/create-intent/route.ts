import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    if (!offerId) {
      return NextResponse.json({ error: "Falta la oferta." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: offer } = await adminSupabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, status")
      .eq("id", offerId)
      .maybeSingle();

    if (!offer) {
      return NextResponse.json({ error: "Oferta no encontrada." }, { status: 404 });
    }

    if (offer.buyer_id !== user.id) {
      return NextResponse.json({ error: "No puedes preparar el pago de esta oferta." }, { status: 403 });
    }

    if (offer.status !== "accepted") {
      return NextResponse.json({ error: "La oferta aún no está aceptada." }, { status: 400 });
    }

    const { data: conversation } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", offer.listing_id)
      .eq("buyer_id", offer.buyer_id)
      .eq("seller_id", offer.seller_id)
      .maybeSingle();

    const now = new Date().toISOString();

    const { data: paymentIntent, error } = await adminSupabase
      .from("payment_intents")
      .upsert(
        {
          listing_id: offer.listing_id,
          conversation_id: conversation?.id || null,
          offer_id: offer.id,
          buyer_id: offer.buyer_id,
          seller_id: offer.seller_id,
          amount: offer.offered_price,
          currency: "EUR",
          provider: "stripe",
          status: "requires_payment_method",
          metadata: { source: "offer_acceptance" },
          updated_at: now,
        },
        { onConflict: "offer_id" }
      )
      .select("id, status, amount, currency")
      .single();

    if (error || !paymentIntent) {
      return NextResponse.json({ error: error?.message || "No se pudo preparar el pago." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, paymentIntent });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo preparar el pago." },
      { status: 500 }
    );
  }
}
