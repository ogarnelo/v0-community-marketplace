import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOfferFlow } from "@/lib/services/offers.service";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json();
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const offeredPrice = Number(body?.offeredPrice);

    if (!listingId || !Number.isFinite(offeredPrice) || offeredPrice <= 0) {
      return NextResponse.json({ error: "La oferta no es válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await createOfferFlow({
      supabase: adminSupabase,
      listingId,
      offeredPrice,
      actorUserId: user.id,
    });

    if (result.alreadyExists) {
      return NextResponse.json(
        {
          ok: false,
          redirectTo: `/messages/${result.conversationId}`,
          conversationId: result.conversationId,
          offerId: result.offerId,
          error: "Ya tienes una negociación abierta para este anuncio. Te llevamos al chat para continuarla.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo crear la oferta." },
      { status: 500 }
    );
  }
}
