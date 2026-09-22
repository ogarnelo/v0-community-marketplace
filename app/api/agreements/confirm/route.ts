import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAgreementConfirmedEmail } from "@/lib/emails/mvp-event-emails";
import { recordAttributedConversion } from "@/lib/growth/server-attribution";
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
    const agreementId =
      typeof body?.agreementId === "string" ? body.agreementId.trim() : "";

    if (!agreementId) {
      return NextResponse.json({ error: "Falta el acuerdo." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_confirm_agreement", {
      p_actor_id: user.id,
      p_agreement_id: agreementId,
    });

    if (error) {
      const message = error.message || "No se pudo confirmar.";
      const lower = message.toLowerCase();

      if (lower.includes("agreement not found")) {
        return NextResponse.json({ error: "No se encontró el acuerdo." }, { status: 404 });
      }
      if (lower.includes("not allowed")) {
        return NextResponse.json({ error: "No puedes confirmar este acuerdo." }, { status: 403 });
      }
      if (lower.includes("current state")) {
        return NextResponse.json(
          { error: "Este acuerdo ya no se puede confirmar." },
          { status: 409 }
        );
      }

      throw error;
    }

    const agreement = normalizeRpcRow<any>(data);
    if (!agreement) {
      return NextResponse.json({ error: "No se pudo confirmar." }, { status: 500 });
    }

    const isConfirmed = agreement.status === "confirmed";
    const recipientId =
      user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id;

    try {
      const { data: notificationListing } = await admin
        .from("listings")
        .select("title")
        .eq("id", agreement.listing_id)
        .maybeSingle();

      await createNotification(admin, {
        user_id: recipientId,
        kind: isConfirmed ? "agreement_confirmed" : "agreement_part_confirmed",
        title: isConfirmed ? "¡Hecho!" : "Propuesta aceptada",
        body: isConfirmed
          ? `Ya habéis llegado a un acuerdo sobre ${notificationListing?.title || "el anuncio"}. Concretad la entrega por el chat.`
          : `${user.user_metadata?.full_name || "La otra persona"} ha aceptado tu propuesta.`,
        href: `/messages/${agreement.conversation_id}#agreement-panel`,
        metadata: {
          agreement_id: agreement.id,
          conversation_id: agreement.conversation_id,
          listing_id: agreement.listing_id,
        },
      });
    } catch (notificationError) {
      console.error("No se pudo crear la notificación de confirmación", notificationError);
    }

    if (isConfirmed) {
      const [
        { data: listing },
        { data: buyerProfile },
        { data: sellerProfile },
        buyerAuth,
        sellerAuth,
      ] = await Promise.all([
        admin.from("listings").select("title").eq("id", agreement.listing_id).maybeSingle(),
        admin.from("profiles").select("full_name").eq("id", agreement.buyer_id).maybeSingle(),
        admin.from("profiles").select("full_name").eq("id", agreement.seller_id).maybeSingle(),
        admin.auth.admin.getUserById(agreement.buyer_id),
        admin.auth.admin.getUserById(agreement.seller_id),
      ]);

      const recipients = [
        {
          id: agreement.buyer_id,
          email: buyerAuth.data.user?.email,
          fullName: buyerProfile?.full_name,
        },
        {
          id: agreement.seller_id,
          email: sellerAuth.data.user?.email,
          fullName: sellerProfile?.full_name,
        },
      ];

      await Promise.all(
        recipients
          .filter((recipient) => recipient.email)
          .map(async (recipient) => {
            try {
              await sendAgreementConfirmedEmail({
                to: recipient.email!,
                recipientName: recipient.fullName,
                listingTitle: listing?.title || "el anuncio",
                conversationId: agreement.conversation_id,
                idempotencyKey: `agreement-confirmed/${agreement.id}/${recipient.id}`,
              });
            } catch (emailError) {
              console.error("No se pudo enviar el email de confirmación", emailError);
            }
          })
      );

      try {
        const sellerRecorded = await recordAttributedConversion(admin, {
          userId: agreement.seller_id,
          eventType: "agreement_confirmed",
          entityId: agreement.id,
        });

        if (!sellerRecorded && agreement.buyer_id !== agreement.seller_id) {
          await recordAttributedConversion(admin, {
            userId: agreement.buyer_id,
            eventType: "agreement_confirmed",
            entityId: agreement.id,
          });
        }
      } catch (attributionError) {
        console.error("No se pudo atribuir el acuerdo confirmado", attributionError);
      }
    }

    return NextResponse.json({ ok: true, agreement });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo confirmar el acuerdo." },
      { status: 500 }
    );
  }
}
