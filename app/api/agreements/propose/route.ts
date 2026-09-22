import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAgreementProposedEmail } from "@/lib/emails/mvp-event-emails";
import { createNotification } from "@/lib/notifications";

function normalizeRpcRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    const note =
      typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;
    const amount =
      body?.amount == null || body?.amount === ""
        ? null
        : Number(body.amount);

    if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
      return NextResponse.json({ error: "El precio propuesto no es válido." }, { status: 400 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Falta la conversación." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_propose_agreement", {
      p_actor_id: user.id,
      p_conversation_id: conversationId,
      p_note: note,
      p_amount: amount,
    });

    if (error) {
      const message = error.message || "No se pudo proponer el acuerdo.";
      const lower = message.toLowerCase();

      if (lower.includes("conversation not found") || lower.includes("listing not found")) {
        return NextResponse.json({ error: "No se encontró la conversación o el anuncio." }, { status: 404 });
      }
      if (lower.includes("not allowed") || lower.includes("seller mismatch")) {
        return NextResponse.json({ error: "No puedes gestionar este acuerdo." }, { status: 403 });
      }
      if (lower.includes("does not accept")) {
        return NextResponse.json({ error: "Este anuncio ya no admite acuerdos nuevos." }, { status: 409 });
      }

      throw error;
    }

    const agreement = normalizeRpcRow<any>(data);
    if (!agreement) {
      return NextResponse.json({ error: "No se pudo crear el acuerdo." }, { status: 500 });
    }

    const [{ data: listing }, { data: recipientProfile }, recipientAuth] =
      await Promise.all([
        admin
          .from("listings")
          .select("title")
          .eq("id", agreement.listing_id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("full_name")
          .eq(
            "id",
            user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id
          )
          .maybeSingle(),
        admin.auth.admin.getUserById(
          user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id
        ),
      ]);

    const recipientId =
      user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id;
    const recipientEmail = recipientAuth.data.user?.email;

    const actorName = user.user_metadata?.full_name || "La otra persona";
    const formattedAmount = Number(agreement.amount || 0).toLocaleString("es-ES", {
      style: "currency",
      currency: "EUR",
    });

    try {
      await createNotification(admin, {
        user_id: recipientId,
        kind: "agreement_proposed",
        title:
          agreement.agreement_type === "donation"
            ? "Solicitud de donación"
            : "Nueva oferta",
        body:
          agreement.agreement_type === "donation"
            ? `${actorName} quiere quedarse con ${listing?.title || "tu artículo"}.`
            : `${actorName} te ofrece ${formattedAmount} por ${listing?.title || "tu artículo"}.`,
        href: `/messages/${agreement.conversation_id}#agreement-panel`,
        metadata: {
          agreement_id: agreement.id,
          conversation_id: agreement.conversation_id,
          listing_id: agreement.listing_id,
        },
      });
    } catch (notificationError) {
      console.error("No se pudo crear la notificación de acuerdo", notificationError);
    }
    if (recipientEmail) {
      try {
        await sendAgreementProposedEmail({
          to: recipientEmail,
          recipientName: recipientProfile?.full_name,
          listingTitle: listing?.title || "el anuncio",
          conversationId: agreement.conversation_id,
          agreementType: agreement.agreement_type,
          amount: agreement.amount == null ? null : Number(agreement.amount),
          actorName,
          idempotencyKey: `agreement-proposed/${agreement.id}`,
        });
      } catch (emailError) {
        console.error("No se pudo enviar el email de propuesta", emailError);
      }
    }

    return NextResponse.json({ ok: true, agreement });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo proponer el acuerdo." },
      { status: 500 }
    );
  }
}
