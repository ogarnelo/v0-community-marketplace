import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}


import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketplacePricing, type DeliveryMethod, type ShipmentTier } from "@/lib/payments/pricing";
import { getAcceptedOfferAmount } from "@/lib/payments/offer-amount";
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode, isPrivateShippingLabelCreationEnabled } from "@/lib/commerce/private-access";

function isShipmentTier(value: unknown): value is ShipmentTier {
  return value === "none" || value === "small" || value === "medium" || value === "large";
}

function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return value === "in_person" || value === "shipping";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const noSession = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: noSession ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: noSession ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    if (!(await canUserUseCommerce(user))) {
      return privateJson({ error: "No disponible." }, { status: 404 });
    }
    if (!isPublicCommerceEnabled()) assertStripeTestMode();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return privateJson({ error: "Solicitud de pago inválida." }, { status: 400 });
    }
    const offerId = typeof body.offerId === "string" ? body.offerId.trim() : "";
    // An explicit invalid delivery selection must never turn into a
    // different quote. Shipping with "none" used to charge zero postage.
    if (body.deliveryMethod !== undefined && !isDeliveryMethod(body.deliveryMethod)) {
      return privateJson({ error: "Método de entrega inválido." }, { status: 400 });
    }
    if (body.shipmentTier !== undefined && !isShipmentTier(body.shipmentTier)) {
      return privateJson({ error: "Tamaño de envío inválido." }, { status: 400 });
    }
    const deliveryMethod: DeliveryMethod = body.deliveryMethod ?? "shipping";
    if (deliveryMethod === "shipping" && body.shipmentTier === "none") {
      return privateJson({ error: "El envío requiere un tamaño con portes." }, { status: 400 });
    }
    const shipmentTier: ShipmentTier = deliveryMethod === "shipping"
      ? body.shipmentTier ?? "small"
      : "none";

    if (!offerId) {
      return privateJson({ error: "Falta la oferta." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: offer, error: offerError } = await adminSupabase
      .from("listing_offers")
      .select("id, listing_id, buyer_id, seller_id, offered_price, current_amount, accepted_amount, counter_price, status")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError) return privateJson({ error: "No se pudo comprobar la oferta." }, { status: 503 });
    if (!offer) {
      return privateJson({ error: "Oferta no encontrada." }, { status: 404 });
    }

    if (offer.buyer_id !== user.id) {
      return privateJson({ error: "No puedes preparar el pago de esta oferta." }, { status: 403 });
    }

    if (offer.status !== "accepted") {
      return privateJson({ error: "La oferta aún no está aceptada." }, { status: 400 });
    }

    const acceptedAmount = getAcceptedOfferAmount(offer);

    if (!Number.isFinite(acceptedAmount) || acceptedAmount <= 0) {
      return privateJson({ error: "El importe aceptado no es válido." }, { status: 400 });
    }

    const pricing = buildMarketplacePricing({
      itemAmount: acceptedAmount,
      deliveryMethod,
      shipmentTier,
    });

    const { data: listing, error: listingError } = await adminSupabase
      .from("listings")
      .select("id, status")
      .eq("id", offer.listing_id)
      .maybeSingle();

    if (listingError) return privateJson({ error: "No se pudo comprobar el anuncio." }, { status: 503 });
    if (!listing) {
      return privateJson({ error: "El anuncio ya no está disponible." }, { status: 404 });
    }

    if (!["available", "reserved"].includes(String(listing.status))) {
      return privateJson({ error: "El anuncio no permite preparar el pago." }, { status: 400 });
    }

    const { data: conversation, error: conversationError } = await adminSupabase
      .from("conversations")
      .select("id")
      .eq("listing_id", offer.listing_id)
      .eq("buyer_id", offer.buyer_id)
      .eq("seller_id", offer.seller_id)
      .maybeSingle();

    if (conversationError) return privateJson({ error: "No se pudo comprobar el chat." }, { status: 503 });

    const now = new Date().toISOString();

    // Production payment_intents(offer_id) has a partial UNIQUE index.
    // Never let a retry downgrade "succeeded" or overwrite a payment amount.
    const columns = "id,status,amount,currency,buyer_fee_amount,shipping_amount,seller_net_amount,shipment_tier,metadata,buyer_id,seller_id,listing_id,offer_id";
    const { data: previous, error: previousError } = await adminSupabase
      .from("payment_intents").select(columns).eq("offer_id", offer.id).maybeSingle();
    if (previousError) {
      return privateJson({ error: "No se pudo verificar el intento de pago." }, { status: 503 });
    }
    const sameCents = (a: unknown,b: number) =>
      a !== null && a !== undefined && Number.isFinite(Number(a)) && Math.round(Number(a)*100) === Math.round(b*100);
    const compatible = (intent: any) =>
      typeof intent?.id === "string" && intent.id.length > 0 &&
      intent.status === "requires_payment_method" &&
      intent.offer_id === offer.id && intent.listing_id === offer.listing_id &&
      intent.buyer_id === offer.buyer_id && intent.seller_id === offer.seller_id &&
      intent.currency === "EUR" && intent.shipment_tier === pricing.shipmentTier &&
      intent.metadata?.delivery_method === pricing.deliveryMethod &&
      sameCents(intent.amount,pricing.itemAmount) &&
      sameCents(intent.buyer_fee_amount,pricing.buyerFeeAmount) &&
      sameCents(intent.shipping_amount,pricing.shippingAmount) &&
      sameCents(intent.seller_net_amount,pricing.sellerNetAmount);

    let paymentIntent: any;
    if (previous) {
      if (!compatible(previous)) {
        return privateJson(
          { error: "Ya existe un intento de pago con otro estado o condiciones. No se puede modificar desde aquí." },
          { status: 409 }
        );
      }
      paymentIntent = previous; // read-only retry; no state or amount mutation
    } else {
      const { data: inserted, error: insertError } = await adminSupabase
        .from("payment_intents")
        .insert({
          listing_id: offer.listing_id,
          conversation_id: conversation?.id || null,
          offer_id: offer.id,
          buyer_id: offer.buyer_id,
          seller_id: offer.seller_id,
          amount: pricing.itemAmount,
          currency: "EUR",
          provider: "stripe",
          status: "requires_payment_method",
          buyer_fee_amount: pricing.buyerFeeAmount,
          shipping_amount: pricing.shippingAmount,
          seller_net_amount: pricing.sellerNetAmount,
          shipment_tier: pricing.shipmentTier,
          metadata: { source: "offer_acceptance", delivery_method: pricing.deliveryMethod },
          updated_at: now,
        })
        .select(columns)
        .single();
      if (insertError?.code === "23505") {
        return privateJson(
          { error: "Otro intento de pago ya se ha preparado; vuelve a consultar su estado." },
          { status: 409 }
        );
      }
      if (insertError || !inserted) {
        return privateJson({ error: "No se pudo preparar el pago." }, { status: 503 });
      }
      // INSERT success alone does not prove the stored payment kept its
      // original amounts and ownership. After this write, fail as requiring
      // reconciliation, never signal that a retry is safe.
      if (!compatible(inserted)) {
        return privateJson({ error: "El pago creado requiere conciliación." }, { status: 503 });
      }
      paymentIntent = inserted;
    }

    if (listing.status === "available") {
      // The intent has already been stored. An unconfirmed CAS means the
      // listing may have been reserved by a different buyer; do not report
      // success while financial and listing states disagree.
      const { data: reserved, error: reserveError } = await adminSupabase
        .from("listings")
        .update({ status: "reserved" })
        .eq("id", listing.id)
        .eq("status", "available")
        .select("id")
        .maybeSingle();
      if (reserveError || reserved?.id !== listing.id) {
        return privateJson({ error: "El pago se creó, pero la reserva requiere conciliación." }, { status: 503 });
      }
    }

    return privateJson({
      ok: true,
      paymentIntent,
      checkout: {
        itemAmount: pricing.itemAmount,
        buyerFeeAmount: pricing.buyerFeeAmount,
        shippingAmount: pricing.shippingAmount,
        totalBuyerAmount: pricing.totalBuyerAmount,
        deliveryMethod: pricing.deliveryMethod,
        shipmentTier: pricing.shipmentTier,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("payment_intent_prepare_failed");
    return privateJson({ error: "No se pudo preparar el pago." }, {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
