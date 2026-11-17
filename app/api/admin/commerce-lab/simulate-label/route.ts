import { NextResponse } from "next/server";
import { requireCommerceLabSuperAdmin } from "@/lib/admin/commerce-lab-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPrivateCommercePreviewEnabled } from "@/lib/commerce/private-access";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: {status?:number} = {}) {
  return NextResponse.json(body, {...options, headers: PRIVATE_HEADERS});
}
export async function POST(request: Request) {
  if (!isPrivateCommercePreviewEnabled()) {
    return privateJson({ error: "No disponible." }, { status: 404 });
  }

  const auth = await requireCommerceLabSuperAdmin();
  if ("error" in auth) return privateJson({ error: auth.error }, { status: auth.status });
  const user = auth.user;

  const body = await request.json().catch(() => ({}));
  const shipmentId =
    typeof body?.shipmentId === "string" ? body.shipmentId.trim() : "";

  if (!shipmentId) {
    return privateJson({ error: "Falta shipmentId." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: shipment, error: shipmentLookupError } = await admin
    .from("shipments")
    .select("id, payment_intent_id, status, payload")
    .eq("id", shipmentId)
    .maybeSingle();

  if (shipmentLookupError) return privateJson({ error: "No se pudo comprobar el envío." }, { status: 503 });
  if (!shipment) {
    return privateJson({ error: "Envío no encontrado." }, { status: 404 });
  }

  if (!["draft", "quoted", "label_pending"].includes(String(shipment.status))) {
    return privateJson(
      { error: "El envío no admite simular etiqueta desde su estado actual." },
      { status: 409 }
    );
  }

  const { data: payment, error: paymentLookupError } = shipment.payment_intent_id
    ? await admin
        .from("payment_intents")
        .select("id, status")
        .eq("id", shipment.payment_intent_id)
        .maybeSingle()
    : { data: null, error: null };

  if (paymentLookupError) return privateJson({ error: "No se pudo comprobar el pago." }, { status: 503 });
  if (!payment || payment.status !== "succeeded") {
    return privateJson(
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

  if (error) return privateJson({ error: "No se pudo simular la etiqueta." }, { status: 503 });
  if (!updated) return privateJson({ error: "El envío ha cambiado. Actualiza la página." }, { status: 409 });

  const { error: eventError } = await admin.from("shipment_events").insert({
    shipment_id: shipment.id,
    event_type: "sandbox_label_ready",
    payload: {
      actor_id: user.id,
      tracking_code: sandboxTrackingCode,
      sandbox_only: true,
    },
    created_at: now,
  });

  if (eventError) return privateJson({
    error: "La etiqueta se simuló, pero requiere conciliar el historial.",
  }, {status:503});
  return privateJson({ ok: true, shipment: updated });
}
