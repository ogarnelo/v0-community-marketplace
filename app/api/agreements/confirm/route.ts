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
    if (!agreementId) return NextResponse.json({ error: "Falta el acuerdo." }, { status: 400 });

    const admin = createAdminClient();
    const { data: agreement, error } = await admin.from("agreements").select("*").eq("id", agreementId).maybeSingle();
    if (error || !agreement) return NextResponse.json({ error: "No se encontró el acuerdo." }, { status: 404 });
    if (agreement.buyer_id !== user.id && agreement.seller_id !== user.id) return NextResponse.json({ error: "No puedes confirmar este acuerdo." }, { status: 403 });
    if (["confirmed", "cancelled", "disputed"].includes(agreement.status)) return NextResponse.json({ ok: true, agreement });

    const now = new Date().toISOString();
    const buyerConfirmedAt = agreement.buyer_confirmed_at || (user.id === agreement.buyer_id ? now : null);
    const sellerConfirmedAt = agreement.seller_confirmed_at || (user.id === agreement.seller_id ? now : null);
    const isConfirmed = Boolean(buyerConfirmedAt && sellerConfirmedAt);
    const status = isConfirmed ? "confirmed" : user.id === agreement.buyer_id ? "buyer_confirmed" : "seller_confirmed";

    const { data: updated, error: updateError } = await admin
      .from("agreements")
      .update({
        buyer_confirmed_at: buyerConfirmedAt,
        seller_confirmed_at: sellerConfirmedAt,
        confirmed_at: isConfirmed ? agreement.confirmed_at || now : null,
        status,
        updated_at: now,
      })
      .eq("id", agreement.id)
      .select("*")
      .single();

    if (updateError || !updated) return NextResponse.json({ error: updateError?.message || "No se pudo confirmar." }, { status: 500 });

    const finalListingStatus = updated.agreement_type === "donation" ? "archived" : "sold";
    await Promise.all([
      admin.from("agreement_events").insert({ agreement_id: agreement.id, actor_id: user.id, event_type: isConfirmed ? "agreement_confirmed" : "agreement_part_confirmed", metadata: { role: user.id === agreement.buyer_id ? "buyer" : "seller" } }),
      isConfirmed ? admin.from("listings").update({ status: finalListingStatus, updated_at: now }).eq("id", agreement.listing_id) : Promise.resolve(),
      agreement.conversation_id ? admin.from("messages").insert({ conversation_id: agreement.conversation_id, sender_id: user.id, body: isConfirmed ? "Acuerdo confirmado por ambas partes. Ya podéis valorar la experiencia." : "He confirmado mi parte del acuerdo. Falta la confirmación de la otra persona." }) : Promise.resolve(),
    ]);

    return NextResponse.json({ ok: true, agreement: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo confirmar el acuerdo." }, { status: 500 });
  }
}
