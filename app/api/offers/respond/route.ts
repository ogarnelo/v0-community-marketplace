import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { respondToOfferFlow, type OfferAction } from "@/lib/services/offers.service";

function isOfferAction(value: unknown): value is OfferAction {
  return value === "accept" || value === "reject" || value === "counter";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
    const action = isOfferAction(body?.action) ? body.action : null;
    const counterPrice = body?.counterPrice == null ? null : Number(body.counterPrice);

    if (!offerId || !action) {
      return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await respondToOfferFlow({
      supabase: adminSupabase,
      offerId,
      action,
      actorUserId: user.id,
      counterPrice,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    const message = error?.message || error?.details || "No se pudo responder a la oferta.";
    const status =
      message.includes("no admite cambios") ||
        message.includes("No puedes") ||
        message.includes("máximo") ||
        message.includes("no es válida")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
