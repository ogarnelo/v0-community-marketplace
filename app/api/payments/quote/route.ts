import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPaymentQuote } from "@/lib/services/payments.service";

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

    if (!offerId) {
      return NextResponse.json({ error: "Falta la oferta." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await buildPaymentQuote({
      supabase: adminSupabase,
      offerId,
      buyerId: user.id,
      deliveryMethod: body?.deliveryMethod,
      shipmentTier: body?.shipmentTier,
    });

    return NextResponse.json({ ok: true, quote: result.quote });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo calcular el importe total." },
      { status: 500 }
    );
  }
}
