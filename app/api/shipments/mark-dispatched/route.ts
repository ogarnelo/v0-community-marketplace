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
    const shipmentId = typeof body?.shipmentId === "string" ? body.shipmentId.trim() : "";
    const trackingCode = typeof body?.trackingCode === "string" ? body.trackingCode.trim() : null;
    const trackingUrl = typeof body?.trackingUrl === "string" ? body.trackingUrl.trim() : null;

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

    const now = new Date().toISOString();
    const { error: updateError } = await adminSupabase
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
      .eq("id", shipmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "No se pudo actualizar el envío." }, { status: 400 });
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
