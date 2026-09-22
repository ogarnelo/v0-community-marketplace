import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode, isPrivateShippingLabelCreationEnabled } from "@/lib/commerce/private-access";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    if (!(await canUserUseCommerce(user))) {
      return NextResponse.json({ error: "No disponible." }, { status: 404 });
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
          return NextResponse.json({ error: "La URL de seguimiento debe usar HTTPS." }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "La URL de seguimiento no es válida." }, { status: 400 });
      }
    }

    if (!shipmentId) {
      return NextResponse.json({ error: "Falta el envío." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: shipment, error: shipmentError } = await adminSupabase
      .from("shipments")
      .select("id, seller_id, status, payload")
      .eq("id", shipmentId)
      .maybeSingle();

    if (shipmentError || !shipment) {
      return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    }

    if (shipment.seller_id !== user.id) {
      return NextResponse.json({ error: "No puedes actualizar este envío." }, { status: 403 });
    }

    if (shipment.status !== "label_ready") {
      return NextResponse.json(
        { error: "Solo puedes marcar el envío cuando la etiqueta está lista." },
        { status: 409 }
      );
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
      .eq("status", "label_ready")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "No se pudo actualizar el envío." }, { status: 400 });
    }

    if (!updatedShipment) {
      return NextResponse.json(
        { error: "El estado del envío ha cambiado. Actualiza la conversación e inténtalo de nuevo." },
        { status: 409 }
      );
    }

    await adminSupabase.from("shipment_events").insert({
      shipment_id: shipmentId,
      event_type: "marked_in_transit",
      payload: {
        actor_id: user.id,
        tracking_code: trackingCode,
        tracking_url: trackingUrl,
      },
      created_at: now,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo actualizar el envío." },
      { status: 500 }
    );
  }
}
