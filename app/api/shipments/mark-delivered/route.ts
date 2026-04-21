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

    const now = new Date().toISOString();
    const { error: updateError } = await adminSupabase
      .from("shipments")
      .update({
        status: "delivered",
        updated_at: now,
      })
      .eq("id", shipmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "No se pudo confirmar la entrega." }, { status: 400 });
    }

    await adminSupabase.from("shipment_events").insert({
      shipment_id: shipmentId,
      event_type: "delivered_confirmed",
      payload: {
        actor_id: user.id,
      },
      created_at: now,
    });

    if (shipment.payment_intent_id) {
      await adminSupabase
        .from("payment_intents")
        .update({
          metadata: {
            delivered_at: now,
          },
          updated_at: now,
        })
        .eq("id", shipment.payment_intent_id);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo confirmar la entrega." },
      { status: 500 }
    );
  }
}
