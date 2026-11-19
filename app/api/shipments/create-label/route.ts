import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}


import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSendcloudParcel, isSendcloudConfigured } from "@/lib/logistics/sendcloud";
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode, isPrivateShippingLabelCreationEnabled } from "@/lib/commerce/private-access";

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
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    console.error("shipping_label_auth_client_unavailable");
    return privateJson({ error: "No se pudo comprobar tu sesión." }, { status: 503 });
  }

  let authResult;
  try {
    authResult = await supabase.auth.getUser();
  } catch {
    console.error("shipping_label_auth_provider_unavailable");
    return privateJson({ error: "No se pudo comprobar tu sesión." }, { status: 503 });
  }
  const { data: authData, error: authError } = authResult;
  if (authError) {
    const absent = authError.name === "AuthSessionMissingError" ||
      authError.code === "session_not_found";
    return privateJson(
      { error: absent ? "No autenticado." : "No se pudo comprobar tu sesión." },
      { status: absent ? 401 : 503 }
    );
  }
  const user = authData?.user ?? null;

  if (!user) {
    return privateJson({ error: "No autorizado." }, { status: 401 });
  }

  if (!(await canUserUseCommerce(user))) {
    return privateJson({ error: "No disponible." }, { status: 404 });
  }
  if (!isPublicCommerceEnabled()) assertStripeTestMode();

  if (!isPublicCommerceEnabled() && !isPrivateShippingLabelCreationEnabled()) {
    return privateJson(
      { error: "La creación real de etiquetas está bloqueada en el preview privado." },
      { status: 409 }
    );
  }

  if (!isSendcloudConfigured()) {
    return privateJson({ error: "Sendcloud no está configurado." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const shipmentId = body?.shipmentId;

  if (!shipmentId || typeof shipmentId !== "string") {
    return privateJson({ error: "shipmentId es obligatorio." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const { data: shipment, error: shipmentError } = await adminSupabase
    .from("shipments")
    .select("*")
    .eq("id", shipmentId)
    .maybeSingle();

  if (shipmentError) return privateJson({ error: "No se pudo consultar el envío." }, { status: 503 });
  if (!shipment) return privateJson({ error: "Envío no encontrado." }, { status: 404 });

  if (shipment.seller_id !== user.id) {
    return privateJson({ error: "Solo el vendedor puede crear la etiqueta." }, { status: 403 });
  }

  if (shipment.label_url) {
    return privateJson({ shipment });
  }

  if (!["draft", "quoted", "label_pending"].includes(String(shipment.status))) {
    return privateJson(
      { error: "Este envío ya no admite crear una etiqueta." },
      { status: 409 }
    );
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

  if (paymentResult.error || listingResult.error || buyerProfileResult.error) {
    return privateJson({ error: "No se pudieron verificar los datos del envío." }, { status: 503 });
  }
  const payment = paymentResult.data;
  const listing = listingResult.data;
  const buyerProfile = buyerProfileResult.data;

  if (!payment) {
    return privateJson({ error: "No se encontró el pago asociado." }, { status: 404 });
  }

  if (payment.status !== "succeeded") {
    return privateJson(
      { error: "El pago debe estar confirmado antes de crear la etiqueta." },
      { status: 409 }
    );
  }
  // A paid intent found through a shipment ID is not authorization to
  // create a parcel: its parties, listing, method and charged postage must
  // match the exact shipment before contacting the external provider.
  const shipmentTier = shipment.shipment_tier || payment.shipment_tier;
  if (payment.id !== shipment.payment_intent_id ||
      !shipment.listing_id || !shipment.buyer_id ||
      payment.listing_id !== shipment.listing_id ||
      payment.buyer_id !== shipment.buyer_id ||
      payment.seller_id !== shipment.seller_id ||
      payment.metadata?.delivery_method !== "shipping" ||
      !["small", "medium", "large"].includes(shipmentTier) ||
      shipment.shipment_tier !== payment.shipment_tier ||
      !Number.isFinite(Number(payment.shipping_amount)) ||
      Number(payment.shipping_amount) <= 0 ||
      !Number.isFinite(Number(payment.amount)) ||
      Number(payment.amount) <= 0) {
    return privateJson(
      { error: "Los datos del envío y del pago no coinciden; requieren conciliación." },
      { status: 409 }
    );
  }

  if (!hasCompleteShippingAddress(buyerProfile)) {
    return privateJson(
      { error: "El comprador aún no tiene una dirección de envío completa en su perfil." },
      { status: 400 }
    );
  }

  try {
    const created = await createSendcloudParcel({
      shipmentId: shipment.id,
      orderNumber: `wetudy-${payment.id}`,
      itemAmount: Number(payment.amount || 0),
      shipmentTier,
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
        status: created.labelUrl ? "label_ready" : "label_pending",
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
      // A Sendcloud label may now exist. Never overwrite this row with manual
      // fallback or automatically issue a second external label on this path.
      console.error("sendcloud_label_created_but_db_update_failed");
      return privateJson(
        { error: "La etiqueta se generó pero no se pudo sincronizar; requiere conciliación antes de reintentar." },
        { status: 503 }
      );
    }

    return privateJson({ shipment: updatedShipment });
  } catch {
    console.error("sendcloud_label_creation_failed");
    await adminSupabase
      .from("shipments")
      .update({
        provider: "manual",
        status: "label_pending",
        payload: {
          mode: "manual_fallback",
          reason: "sendcloud_error",
          message: "No se pudo crear la etiqueta.",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipment.id);

    return privateJson(
      { error: "No se pudo crear la etiqueta de Sendcloud." },
      { status: 500 }
    );
  }
}
