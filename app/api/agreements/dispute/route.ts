import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const agreementId = typeof body?.agreementId === "string" ? body.agreementId.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "Incidencia abierta desde el acuerdo.";
    if (!agreementId) return NextResponse.json({ error: "Falta el acuerdo." }, { status: 400 });

    const admin = createAdminClient();
    const { data: agreement } = await admin.from("agreements").select("*").eq("id", agreementId).maybeSingle();
    if (!agreement) return NextResponse.json({ error: "No se encontró el acuerdo." }, { status: 404 });
    if (agreement.buyer_id !== user.id && agreement.seller_id !== user.id) return NextResponse.json({ error: "No puedes reportar este acuerdo." }, { status: 403 });

    const now = new Date().toISOString();
    const { data: updated, error } = await admin.from("agreements").update({ status: "disputed", disputed_at: now, updated_at: now }).eq("id", agreement.id).select("*").single();
    if (error || !updated) return NextResponse.json({ error: error?.message || "No se pudo reportar." }, { status: 500 });

    await Promise.all([
      admin.from("agreement_events").insert({ agreement_id: agreement.id, actor_id: user.id, event_type: "agreement_disputed", note }),
      admin.from("reports").insert({ reporter_id: user.id, target_type: "agreement", listing_id: agreement.listing_id, conversation_id: agreement.conversation_id, reason: "agreement_dispute", details: note, status: "open" }),
      agreement.conversation_id ? admin.from("messages").insert({ conversation_id: agreement.conversation_id, sender_id: user.id, body: "Se ha abierto una incidencia sobre este acuerdo. Wetudy conservará el historial para revisión." }) : Promise.resolve(),
    ]);

    return NextResponse.json({ ok: true, agreement: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo reportar el acuerdo." }, { status: 500 });
  }
}
