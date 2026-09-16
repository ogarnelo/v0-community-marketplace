import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAgreementConfirmedEmail } from "@/lib/emails/mvp-event-emails";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const agreementId = typeof body?.agreementId === "string" ? body.agreementId.trim() : "";
    if (!agreementId) return NextResponse.json({ error: "Falta el acuerdo." }, { status: 400 });
    const admin = createAdminClient();
    const { data: agreement } = await admin.from("agreements").select("*").eq("id", agreementId).maybeSingle();
    if (!agreement) return NextResponse.json({ error: "No se encontró el acuerdo." }, { status: 404 });
    if (agreement.buyer_id !== user.id && agreement.seller_id !== user.id) return NextResponse.json({ error: "No puedes confirmar este acuerdo." }, { status: 403 });
    if (["confirmed", "cancelled", "disputed"].includes(agreement.status)) return NextResponse.json({ ok: true, agreement });

    const now = new Date().toISOString();
    const buyerConfirmedAt = agreement.buyer_confirmed_at || (user.id === agreement.buyer_id ? now : null);
    const sellerConfirmedAt = agreement.seller_confirmed_at || (user.id === agreement.seller_id ? now : null);
    const isConfirmed = Boolean(buyerConfirmedAt && sellerConfirmedAt);
    const status = isConfirmed ? "confirmed" : user.id === agreement.buyer_id ? "buyer_confirmed" : "seller_confirmed";
    const { data: updated, error: updateError } = await admin.from("agreements").update({ buyer_confirmed_at: buyerConfirmedAt, seller_confirmed_at: sellerConfirmedAt, confirmed_at: isConfirmed ? agreement.confirmed_at || now : null, status, updated_at: now }).eq("id", agreement.id).select("*").single();
    if (updateError || !updated) return NextResponse.json({ error: updateError?.message || "No se pudo confirmar." }, { status: 500 });

    const finalListingStatus = updated.agreement_type === "donation" ? "archived" : "sold";
    await Promise.all([
      admin.from("agreement_events").insert({ agreement_id: agreement.id, actor_id: user.id, event_type: isConfirmed ? "agreement_confirmed" : "agreement_part_confirmed", metadata: { role: user.id === agreement.buyer_id ? "buyer" : "seller" } }),
      isConfirmed ? admin.from("listings").update({ status: finalListingStatus, updated_at: now }).eq("id", agreement.listing_id) : Promise.resolve(),
      agreement.conversation_id ? admin.from("messages").insert({ conversation_id: agreement.conversation_id, sender_id: user.id, body: isConfirmed ? "Acuerdo confirmado por ambas partes. Ya podéis valorar la experiencia." : "He confirmado mi parte del acuerdo. Falta la confirmación de la otra persona." }) : Promise.resolve(),
    ]);

    if (isConfirmed) {
      const [{ data: listing }, { data: buyerProfile }, { data: sellerProfile }, buyerAuth, sellerAuth] = await Promise.all([
        admin.from("listings").select("title").eq("id", agreement.listing_id).maybeSingle(),
        admin.from("profiles").select("full_name").eq("id", agreement.buyer_id).maybeSingle(),
        admin.from("profiles").select("full_name").eq("id", agreement.seller_id).maybeSingle(),
        admin.auth.admin.getUserById(agreement.buyer_id),
        admin.auth.admin.getUserById(agreement.seller_id),
      ]);
      const recipients = [
        { id: agreement.buyer_id, email: buyerAuth.data.user?.email, fullName: buyerProfile?.full_name },
        { id: agreement.seller_id, email: sellerAuth.data.user?.email, fullName: sellerProfile?.full_name },
      ];
      await Promise.all(recipients.filter((recipient) => recipient.email).map(async (recipient) => {
        try {
          await sendAgreementConfirmedEmail({
            to: recipient.email!,
            recipientName: recipient.fullName,
            listingTitle: listing?.title || "el anuncio",
            conversationId: agreement.conversation_id,
            idempotencyKey: `agreement-confirmed/${agreement.id}/${recipient.id}`,
          });
        } catch (emailError) { console.error("No se pudo enviar el email de confirmación", emailError); }
      }));
    }
    return NextResponse.json({ ok: true, agreement: updated });
  } catch (error: any) { return NextResponse.json({ error: error?.message || "No se pudo confirmar el acuerdo." }, { status: 500 }); }
}
