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
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;
    if (!agreementId) return NextResponse.json({ error: "Falta el acuerdo." }, { status: 400 });

    const admin = createAdminClient();
    const { data: agreement } = await admin.from("agreements").select("*").eq("id", agreementId).maybeSingle();
    if (!agreement) return NextResponse.json({ error: "No se encontró el acuerdo." }, { status: 404 });
    if (agreement.buyer_id !== user.id && agreement.seller_id !== user.id) return NextResponse.json({ error: "No puedes cancelar este acuerdo." }, { status: 403 });
    if (agreement.status === "confirmed") return NextResponse.json({ error: "Un acuerdo confirmado no se cancela desde aquí. Usa reportar incidencia." }, { status: 409 });

    const now = new Date().toISOString();
    const { data: updated, error } = await admin.from("agreements").update({ status: "cancelled", cancelled_at: now, updated_at: now }).eq("id", agreement.id).select("*").single();
    if (error || !updated) return NextResponse.json({ error: error?.message || "No se pudo cancelar." }, { status: 500 });

    await Promise.all([
      admin.from("agreement_events").insert({ agreement_id: agreement.id, actor_id: user.id, event_type: "agreement_cancelled", note }),
      admin.from("listings").update({ status: "available", updated_at: now }).eq("id", agreement.listing_id).eq("status", "reserved"),
      agreement.conversation_id ? admin.from("messages").insert({ conversation_id: agreement.conversation_id, sender_id: user.id, body: "El acuerdo se ha cancelado. El anuncio puede volver a estar disponible." }) : Promise.resolve(),
    ]);

    return NextResponse.json({ ok: true, agreement: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo cancelar el acuerdo." }, { status: 500 });
  }
}
