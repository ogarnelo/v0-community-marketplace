import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...options, headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) } });
}


import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode, isPrivateShippingLabelCreationEnabled } from "@/lib/commerce/private-access";

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

    const body = await request.json();
    const shipmentId = typeof body?.shipmentId === "string" ? body.shipmentId.trim() : "";
    const trackingCode =
      typeof body?.trackingCode === "string"
        ? body.trackingCode.trim().slice(0, 120) || null
        : null;
    const trackingUrl =
      typeof body?.trackingUrl === "string"
        ? body.trackingUrl.trim().slice(0, 500) || null
        : null;

    if (trackingUrl) {
      try {
        const parsedTrackingUrl = new URL(trackingUrl);
        if (parsedTrackingUrl.protocol !== "https:") {
          return privateJson({ error: "La URL de seguimiento debe usar HTTPS." }, { status: 400 });
        }
      } catch {
        return privateJson({ error: "La URL de seguimiento no es válida." }, { status: 400 });
      }
    }

    if (!shipmentId) {
      return privateJson({ error: "Falta el envío." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: shipment, error: shipmentError } = await adminSupabase
      .from("shipments")
      .select("id, seller_id, buyer_id, listing_id, payment_intent_id, status, payload")
      .eq("id", shipmentId)
      .maybeSingle();

    if (shipmentError) return privateJson({ error: "No se pudo consultar el envío." }, { status: 503 });
    if (!shipment) return privateJson({ error: "Envío no encontrado." }, { status: 404 });

    if (shipment.seller_id !== user.id) {
      return privateJson({ error: "No puedes actualizar este envío." }, { status: 403 });
    }

    if (shipment.status !== "label_ready") {
      return privateJson(
        { error: "Solo puedes marcar el envío cuando la etiqueta está lista." },
        { status: 409 }
      );
    }

    // Label readiness is not proof that the order is still paid.
    // Reject missing or cross-actor payments before updating status/tracking.
    if (!shipment.payment_intent_id || !shipment.listing_id ||
        !shipment.buyer_id || !shipment.seller_id) {
      return privateJson({ error: "El envío no tiene un pago verificable." }, { status: 409 });
    }
    const { data: payment, error: paymentError } = await adminSupabase
      .from("payment_intents")
      .select("id, status, buyer_id, seller_id, listing_id, metadata")
      .eq("id", shipment.payment_intent_id)
      .maybeSingle();
    if (paymentError) {
      return privateJson({ error: "No se pudo verificar el pago del envío." }, { status: 503 });
    }
    if (!payment || payment.id !== shipment.payment_intent_id ||
        payment.status !== "succeeded" ||
        payment.buyer_id !== shipment.buyer_id ||
        payment.seller_id !== shipment.seller_id ||
        payment.listing_id !== shipment.listing_id ||
        payment.metadata?.delivery_method !== "shipping") {
      return privateJson({ error: "Este envío no tiene un pago confirmado compatible." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: updatedShipment, error: updateError } = await adminSupabase
      .from("shipments")
      .update({
        status: "in_transit",
        tracking_code: trackingCode,
        tracking_url: trackingUrl,
        payload: {
          ...(shipment.payload || {}),
          manual_dispatch_at: now,
        },
        updated_at: now,
      })
      .eq("id", shipmentId)
      .eq("seller_id", user.id)
      .eq("payment_intent_id", payment.id)
      .eq("status", "label_ready")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return privateJson({ error: "No se pudo actualizar el envío." }, { status: 503 });
    }

    if (!updatedShipment) {
      return privateJson(
        { error: "El estado del envío ha cambiado. Actualiza la conversación e inténtalo de nuevo." },
        { status: 409 }
      );
    }

    const { error: eventError } = await adminSupabase.from("shipment_events").insert({
      shipment_id: shipmentId,
      event_type: "marked_in_transit",
      payload: {
        actor_id: user.id,
        tracking_code: trackingCode,
        tracking_url: trackingUrl,
      },
      created_at: now,
    });

    if (eventError) {
      console.error("shipment_dispatch_event_write_failed");
      return privateJson(
        { error: "El envío se actualizó, pero falta registrar su historial. Requiere conciliación." },
        { status: 503 }
      );
    }

    return privateJson({ ok: true });
  } catch {
    console.error("shipping_dispatch_failed");
    return privateJson({ error: "No se pudo actualizar el envío." }, { status: 500 });
  }
}
