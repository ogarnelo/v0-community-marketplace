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

    if (!shipmentId) {
      return privateJson({ error: "Falta el envío." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: shipment, error: shipmentError } = await adminSupabase
      .from("shipments")
      .select("id, buyer_id, payment_intent_id, status")
      .eq("id", shipmentId)
      .maybeSingle();

    if (shipmentError) return privateJson({ error: "No se pudo consultar el envío." }, { status: 503 });
    if (!shipment) return privateJson({ error: "Envío no encontrado." }, { status: 404 });

    if (shipment.buyer_id !== user.id) {
      return privateJson({ error: "No puedes confirmar este envío." }, { status: 403 });
    }

    if (shipment.status !== "in_transit") {
      return privateJson(
        { error: "Solo puedes confirmar la entrega cuando el envío está en tránsito." },
        { status: 409 }
      );
    }

    const { data: payment, error: paymentError } = shipment.payment_intent_id
      ? await adminSupabase
          .from("payment_intents")
          .select("id, status, metadata")
          .eq("id", shipment.payment_intent_id)
          .maybeSingle()
      : { data: null, error: null };

    if (paymentError) {
      return privateJson(
        { error: "No se pudo verificar el pago asociado." },
        { status: 503 }
      );
    }

    if (shipment.payment_intent_id && (!payment || payment.status !== "succeeded")) {
      return privateJson(
        { error: "El pago asociado debe estar confirmado antes de cerrar el envío." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const { data: updatedShipment, error: updateError } = await adminSupabase
      .from("shipments")
      .update({
        status: "delivered",
        updated_at: now,
      })
      .eq("id", shipmentId)
      .eq("status", "in_transit")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return privateJson({ error: "No se pudo confirmar la entrega." }, { status: 503 });
    }

    if (!updatedShipment) {
      return privateJson(
        { error: "El estado del envío ha cambiado. Actualiza la conversación e inténtalo de nuevo." },
        { status: 409 }
      );
    }

    const { error: eventError } = await adminSupabase.from("shipment_events").insert({
      shipment_id: shipmentId,
      event_type: "delivered_confirmed",
      payload: {
        actor_id: user.id,
      },
      created_at: now,
    });

    let reconciliationRequired = Boolean(eventError);
    if (eventError) {
      console.error("shipment_delivery_event_write_failed");
    }

    if (payment) {
      const { data: paymentUpdated, error: paymentUpdateError } = await adminSupabase
        .from("payment_intents")
        .update({
          metadata: {
            ...(payment.metadata || {}),
            delivered_at: now,
          },
          updated_at: now,
        })
        .eq("id", payment.id)
        .eq("status", "succeeded")
        .select("id")
        .maybeSingle();

      if (paymentUpdateError || !paymentUpdated) {
        console.error("shipment_delivery_payment_metadata_write_failed");
        reconciliationRequired = true;
      }
    }

    if (reconciliationRequired) {
      return privateJson(
        { error: "La entrega se confirmó, pero falta conciliar el historial o el pago." },
        { status: 503 }
      );
    }
    return privateJson({ ok: true });
  } catch {
    console.error("shipping_delivery_failed");
    return privateJson({ error: "No se pudo confirmar la entrega." }, { status: 500 });
  }
}
