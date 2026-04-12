import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSendcloudParcel, isSendcloudConfigured } from "@/lib/logistics/sendcloud";

function hasCompleteShippingAddress(profile: any) {
  return Boolean(
    profile?.shipping_address_line1 &&
    profile?.shipping_city &&
    profile?.postal_code &&
    profile?.shipping_country_code
  );
}

function pickFullName(profile: any, fallbackEmail?: string | null) {
  return profile?.business_name || profile?.full_name || fallbackEmail || "Usuario";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!isSendcloudConfigured()) {
    return NextResponse.json({ error: "Sendcloud no está configurado." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const shipmentId = body?.shipmentId;

  if (!shipmentId || typeof shipmentId !== "string") {
    return NextResponse.json({ error: "shipmentId es obligatorio." }, { status: 400 });
  }

  const { data: shipment, error: shipmentError } = await adminSupabase
    .from("shipments")
    .select("*")
    .eq("id", shipmentId)
    .maybeSingle();

  if (shipmentError || !shipment) {
    return NextResponse.json({ error: shipmentError?.message || "Envío no encontrado." }, { status: 404 });
  }

  if (shipment.seller_id !== user.id) {
    return NextResponse.json({ error: "Solo el vendedor puede crear la etiqueta." }, { status: 403 });
  }

  if (shipment.label_url) {
    return NextResponse.json({ shipment });
  }

  const [paymentResult, listingResult, buyerProfileResult] = await Promise.all([
    shipment.payment_intent_id
      ? adminSupabase.from("payment_intents").select("*").eq("id", shipment.payment_intent_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    shipment.listing_id
      ? adminSupabase.from("listings").select("id, title").eq("id", shipment.listing_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    shipment.buyer_id
      ? adminSupabase
        .from("profiles")
        .select("full_name, business_name, postal_code, shipping_address_line1, shipping_address_line2, shipping_city, shipping_region, shipping_country_code, phone")
        .eq("id", shipment.buyer_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const payment = paymentResult.data;
  const listing = listingResult.data;
  const buyerProfile = buyerProfileResult.data;

  if (!payment) {
    return NextResponse.json({ error: "No se encontró el pago asociado." }, { status: 404 });
  }

  if (!hasCompleteShippingAddress(buyerProfile)) {
    return NextResponse.json(
      { error: "El comprador aún no tiene una dirección de envío completa en su perfil." },
      { status: 400 }
    );
  }

  try {
    const created = await createSendcloudParcel({
      shipmentId: shipment.id,
      orderNumber: `wetudy-${payment.id}`,
      itemAmount: Number(payment.amount || 0),
      shipmentTier: shipment.shipment_tier || payment.shipment_tier || "small",
      recipient: {
        name: pickFullName(buyerProfile, payment?.metadata?.buyer_email),
        company_name: buyerProfile?.business_name || null,
        address: buyerProfile?.shipping_address_line1,
        address_2: buyerProfile?.shipping_address_line2 || null,
        city: buyerProfile?.shipping_city,
        postal_code: buyerProfile?.postal_code,
        country: buyerProfile?.shipping_country_code || "ES",
        email: payment?.metadata?.buyer_email || null,
        telephone: buyerProfile?.phone || null,
      },
    });

    const { data: updatedShipment, error: updateError } = await adminSupabase
      .from("shipments")
      .update({
        provider: "sendcloud",
        provider_shipment_id: created.providerShipmentId,
        status: created.labelUrl ? "label_created" : "ready_to_ship",
        service_code: created.serviceName || null,
        tracking_code: created.trackingCode,
        tracking_url: created.trackingUrl,
        label_url: created.labelUrl,
        payload: {
          shipping_method_id: created.shippingMethodId,
          provider_status: created.providerStatus,
          listing_title: listing?.title || null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipment.id)
      .select("*")
      .single();

    if (updateError || !updatedShipment) {
      throw new Error(updateError?.message || "No se pudo actualizar el envío.");
    }

    return NextResponse.json({ shipment: updatedShipment });
  } catch (error: any) {
    await adminSupabase
      .from("shipments")
      .update({
        provider: "manual",
        status: "manual_pending",
        payload: {
          mode: "manual_fallback",
          reason: "sendcloud_error",
          message: error?.message || "No se pudo crear la etiqueta.",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipment.id);

    return NextResponse.json(
      { error: error?.message || "No se pudo crear la etiqueta de Sendcloud." },
      { status: 500 }
    );
  }
}
