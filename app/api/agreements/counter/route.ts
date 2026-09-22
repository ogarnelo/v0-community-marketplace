import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const amount = Number(body?.amount);
    const note =
      typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

    if (!agreementId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "La nueva propuesta no es válida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_counter_agreement", {
      p_actor_id: user.id,
      p_agreement_id: agreementId,
      p_amount: amount,
      p_note: note,
    });

    if (error) {
      const message = error.message || "No se pudo enviar la nueva propuesta.";
      const lower = message.toLowerCase();
      if (lower.includes("agreement not found")) {
        return NextResponse.json({ error: "No se encontró el acuerdo." }, { status: 404 });
      }
      if (lower.includes("not allowed")) {
        return NextResponse.json({ error: "No puedes modificar este acuerdo." }, { status: 403 });
      }
      if (lower.includes("current state")) {
        return NextResponse.json({ error: "Este acuerdo ya no admite nuevas propuestas." }, { status: 409 });
      }
      throw error;
    }

    const agreement = normalizeRpcRow<any>(data);
    if (!agreement) {
      return NextResponse.json({ error: "No se pudo actualizar el acuerdo." }, { status: 500 });
    }

    const recipientId =
      user.id === agreement.buyer_id ? agreement.seller_id : agreement.buyer_id;

    try {
      await createNotification(admin, {
        user_id: recipientId,
        kind: "agreement_countered",
        title: "Nueva propuesta de precio",
        body: `${user.user_metadata?.full_name || "La otra persona"} propone ${Number(agreement.amount).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}.`,
        href: `/messages/${agreement.conversation_id}`,
        metadata: {
          agreement_id: agreement.id,
          conversation_id: agreement.conversation_id,
          listing_id: agreement.listing_id,
        },
      });
    } catch (notificationError) {
      console.error("No se pudo crear la notificación de contraoferta", notificationError);
    }

    return NextResponse.json({ ok: true, agreement });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo enviar la nueva propuesta." },
      { status: 500 }
    );
  }
}
