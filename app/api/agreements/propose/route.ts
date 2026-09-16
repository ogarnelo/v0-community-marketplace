import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAgreementProposedEmail } from "@/lib/emails/mvp-event-emails";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;
    if (!conversationId) return NextResponse.json({ error: "Falta la conversación." }, { status: 400 });

    const admin = createAdminClient();
    const { data: conversation } = await admin.from("conversations").select("id, listing_id, buyer_id, seller_id").eq("id", conversationId).maybeSingle();
    if (!conversation) return NextResponse.json({ error: "No se encontró la conversación." }, { status: 404 });
    if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) return NextResponse.json({ error: "No puedes gestionar este acuerdo." }, { status: 403 });
    const { data: listing } = await admin.from("listings").select("id, title, seller_id, school_id, listing_type, type, price, status").eq("id", conversation.listing_id).maybeSingle();
    if (!listing) return NextResponse.json({ error: "No se encontró el anuncio." }, { status: 404 });
    if (!["available", "reserved"].includes(String(listing.status || "available"))) return NextResponse.json({ error: "Este anuncio ya no admite acuerdos nuevos." }, { status: 409 });

    const { data: existing } = await admin.from("agreements").select("*").eq("conversation_id", conversation.id).in("status", ["proposed", "buyer_confirmed", "seller_confirmed", "confirmed", "disputed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.id) return NextResponse.json({ ok: true, agreement: existing, alreadyExists: true });

    const agreementType = listing.listing_type === "donation" || listing.type === "donation" ? "donation" : "sale";
    const starterStatus = user.id === conversation.buyer_id ? "buyer_confirmed" : "seller_confirmed";
    const now = new Date().toISOString();
    const insertPayload: Record<string, unknown> = { listing_id: conversation.listing_id, conversation_id: conversation.id, buyer_id: conversation.buyer_id, seller_id: conversation.seller_id, school_id: listing.school_id, agreement_type: agreementType, status: starterStatus, amount: agreementType === "sale" ? listing.price : null, handoff_note: note };
    if (user.id === conversation.buyer_id) insertPayload.buyer_confirmed_at = now;
    if (user.id === conversation.seller_id) insertPayload.seller_confirmed_at = now;
    const { data: agreement, error: insertError } = await admin.from("agreements").insert(insertPayload).select("*").single();
    if (insertError || !agreement) return NextResponse.json({ error: insertError?.message || "No se pudo crear el acuerdo." }, { status: 500 });

    await Promise.all([
      admin.from("agreement_events").insert({ agreement_id: agreement.id, actor_id: user.id, event_type: "agreement_proposed", note, metadata: { source: "chat" } }),
      admin.from("listings").update({ status: "reserved", updated_at: now }).eq("id", conversation.listing_id).eq("status", "available"),
      admin.from("messages").insert({ conversation_id: conversation.id, sender_id: user.id, body: agreementType === "donation" ? "He propuesto confirmar esta donación. Falta la confirmación de la otra parte." : "He propuesto confirmar este acuerdo. Falta la confirmación de la otra parte." }),
    ]);

    const recipientId = user.id === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;
    const { data: recipient } = await admin.from("profiles").select("email, full_name").eq("id", recipientId).maybeSingle();
    if (recipient?.email) {
      try { await sendAgreementProposedEmail({ to: recipient.email, recipientName: recipient.full_name, listingTitle: listing.title || "el anuncio", conversationId: conversation.id }); }
      catch (emailError) { console.error("No se pudo enviar el email de propuesta", emailError); }
    }
    return NextResponse.json({ ok: true, agreement });
  } catch (error: any) { return NextResponse.json({ error: error?.message || "No se pudo proponer el acuerdo." }, { status: 500 }); }
}
