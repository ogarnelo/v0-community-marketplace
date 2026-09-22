import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPrivateCommercePreviewEnabled } from "@/lib/commerce/private-access";

export async function POST(request: Request) {
  if (!isPrivateCommercePreviewEnabled()) {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roles?.length) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const shipmentId =
    typeof body?.shipmentId === "string" ? body.shipmentId.trim() : "";

  if (!shipmentId) {
    return NextResponse.json({ error: "Falta shipmentId." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: shipment } = await admin
    .from("shipments")
    .select("id, payment_intent_id, status, payload")
    .eq("id", shipmentId)
    .maybeSingle();

  if (!shipment) {
    return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
  }

  if (!["draft", "quoted", "label_pending"].includes(String(shipment.status))) {
    return NextResponse.json(
      { error: "El envío no admite simular etiqueta desde su estado actual." },
      { status: 409 }
    );
  }

  const { data: payment } = shipment.payment_intent_id
    ? await admin
        .from("payment_intents")
        .select("id, status")
        .eq("id", shipment.payment_intent_id)
        .maybeSingle()
    : { data: null };

  if (!payment || payment.status !== "succeeded") {
    return NextResponse.json(
      { error: "La simulación exige un pago Stripe test confirmado." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const sandboxTrackingCode = `TEST-${shipment.id.slice(0, 8).toUpperCase()}`;

  const { data: updated, error } = await admin
    .from("shipments")
    .update({
      provider: "sandbox",
      status: "label_ready",
      tracking_code: sandboxTrackingCode,
      tracking_url: null,
      label_url: null,
      payload: {
        ...(shipment.payload || {}),
        sandbox_label_simulated_at: now,
        sandbox_only: true,
      },
      updated_at: now,
    })
    .eq("id", shipment.id)
    .in("status", ["draft", "quoted", "label_pending"])
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || "No se pudo simular la etiqueta." },
      { status: 409 }
    );
  }

  await admin.from("shipment_events").insert({
    shipment_id: shipment.id,
    event_type: "sandbox_label_ready",
    payload: {
      actor_id: user.id,
      tracking_code: sandboxTrackingCode,
      sandbox_only: true,
    },
    created_at: now,
  });

  return NextResponse.json({ ok: true, shipment: updated });
}
