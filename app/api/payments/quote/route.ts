import { NextResponse } from "next/server";
import { getVerifiedCommerceUser } from "@/lib/commerce/verified-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPaymentQuote } from "@/lib/services/payments.service";
import { canUserUseCommerce, isPublicCommerceEnabled, assertStripeTestMode } from "@/lib/commerce/private-access";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(payload: unknown, opts:{status?:number}={}) {
  return NextResponse.json(payload,{...opts,headers:PRIVATE_HEADERS});
}
export async function POST(request: Request) {
  try {
    const auth = await getVerifiedCommerceUser();
    if (!auth.user) return privateJson(
      { error: auth.errorStatus === 401 ? "No autenticado." : "No se pudo comprobar tu sesión." },
      { status: auth.errorStatus ?? 503 }
    );
    const user = auth.user;

    if (!(await canUserUseCommerce(user))) {
      return privateJson({ error: "No disponible." }, { status: 404 });
    }
    if (!isPublicCommerceEnabled()) assertStripeTestMode();

    const body = await request.json();
    const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";

    if (!offerId) {
      return privateJson({ error: "Falta la oferta." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await buildPaymentQuote({
      supabase: adminSupabase,
      offerId,
      buyerId: user.id,
      deliveryMethod: body?.deliveryMethod,
      shipmentTier: body?.shipmentTier,
    });

    return privateJson({ ok: true, quote: result.quote });
  } catch {
    console.error("payment_quote_failed");
    return privateJson(
      { error: "No se pudo calcular el importe total." },
      { status: 503 }
    );
  }
}
