import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLegacyCommerceEnabled } from "@/lib/launch/feature-gates";

export async function POST(request: Request) {
  if (!isLegacyCommerceEnabled()) {
    return NextResponse.json(
      { error: "Esta función no está activa durante el lanzamiento inicial de Wetudy." },
      { status: 404 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const shipmentId = typeof body?.shipmentId === "string" ? body.shipmentId.trim() : "";

    if (!shipmentId) {
      return NextResponse.json({ error: "Falta el envío." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: shipment, error: shipmentError } = await adminSupabase
      .from("shipments")
      .select("id, buyer_id, payment_intent_id, status")
      .eq("id", shipmentId)
      .maybeSingle();

    if (shipmentError || !shipment) {
      return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    }

    if (shipment.buyer_id !== user.id) {
      return NextResponse.json({ error: "No puedes confirmar este envío." }, { status: 403 });
    }

    if (shipment.status !== "in_transit") {
      return NextResponse.json(
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
      return NextResponse.json(
        { error: paymentError.message || "No se pudo verificar el pago asociado." },
        { status: 400 }
      );
    }

    if (shipment.payment_intent_id && (!payment || payment.status !== "succeeded")) {
      return NextResponse.json(
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
      return NextResponse.json({ error: updateError.message || "No se pudo confirmar la entrega." }, { status: 400 });
    }

    if (!updatedShipment) {
      return NextResponse.json(
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

    if (eventError) {
      console.error("No se pudo registrar el evento de entrega", {
        shipmentId,
        error: eventError,
      });
    }

    if (payment) {
      const { error: paymentUpdateError } = await adminSupabase
        .from("payment_intents")
        .update({
          metadata: {
            ...(payment.metadata || {}),
            delivered_at: now,
          },
          updated_at: now,
        })
        .eq("id", payment.id)
        .eq("status", "succeeded");

      if (paymentUpdateError) {
        console.error("No se pudo registrar delivered_at en el pago", {
          paymentIntentId: payment.id,
          error: paymentUpdateError,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo confirmar la entrega." },
      { status: 500 }
    );
  }
}
