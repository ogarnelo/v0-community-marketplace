import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStripeTestMode,
  isPrivateCommercePreviewEnabled,
} from "@/lib/commerce/private-access";
import { stripe } from "@/lib/stripe";
import { resolveStripePaymentIntentAndCharge } from "@/lib/commerce/settlement";
import { syncSellerConnectAccount } from "@/lib/commerce/connect";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado.", status: 401 as const };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roles?.length) return { error: "No autorizado.", status: 403 as const };
  return { user };
}

export async function POST(request: Request) {
  if (!isPrivateCommercePreviewEnabled()) {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }
  assertStripeTestMode();

  const auth = await requireSuperAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const paymentIntentId =
    typeof body?.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";

  if (!paymentIntentId) {
    return NextResponse.json({ error: "Falta paymentIntentId." }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const { data: payment, error: paymentError } = await admin
      .from("payment_intents")
      .select(
        "id, buyer_id, seller_id, status, seller_net_amount, currency, provider_payment_intent_id, metadata"
      )
      .eq("id", paymentIntentId)
      .maybeSingle();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }

    if (payment.status !== "succeeded") {
      return NextResponse.json(
        { error: "Solo se puede liberar un pago confirmado." },
        { status: 409 }
      );
    }

    const sellerNetAmount = Number(payment.seller_net_amount);
    if (!Number.isFinite(sellerNetAmount) || sellerNetAmount <= 0) {
      return NextResponse.json(
        { error: "El importe neto del vendedor no es válido." },
        { status: 409 }
      );
    }

    const deliveryMethod = payment.metadata?.delivery_method;
    if (deliveryMethod === "shipping") {
      const { data: shipment } = await admin
        .from("shipments")
        .select("id, status")
        .eq("payment_intent_id", payment.id)
        .maybeSingle();

      if (!shipment || shipment.status !== "delivered") {
        return NextResponse.json(
          { error: "El envío debe estar entregado antes de liberar fondos." },
          { status: 409 }
        );
      }
    }

    const { data: connectRow } = await admin
      .from("seller_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", payment.seller_id)
      .maybeSingle();

    if (!connectRow?.stripe_account_id) {
      return NextResponse.json(
        { error: "El vendedor todavía no tiene una cuenta Stripe Connect test." },
        { status: 409 }
      );
    }

    const { status: connectStatus } = await syncSellerConnectAccount({
      userId: payment.seller_id,
      stripeAccountId: connectRow.stripe_account_id,
    });

    if (!connectStatus.transfersActive || !connectStatus.payoutsEnabled) {
      return NextResponse.json(
        { error: "La cuenta Stripe del vendedor todavía no está lista para recibir fondos." },
        { status: 409 }
      );
    }

    const { data: existingTransfer } = await admin
      .from("commerce_transfers")
      .select("*")
      .eq("payment_intent_id", payment.id)
      .maybeSingle();

    if (existingTransfer?.status === "released") {
      return NextResponse.json({ ok: true, transfer: existingTransfer, existing: true });
    }
    if (existingTransfer?.status === "reversed") {
      return NextResponse.json(
        { error: "Esta transferencia ya fue revertida y no puede liberarse de nuevo." },
        { status: 409 }
      );
    }

    const checkoutSessionId =
      typeof payment.metadata?.stripe_checkout_session_id === "string"
        ? payment.metadata.stripe_checkout_session_id
        : null;

    const { chargeId, providerPaymentIntentId } =
      await resolveStripePaymentIntentAndCharge({
        providerPaymentIntentId: payment.provider_payment_intent_id,
        checkoutSessionId,
      });

    const amountCents = Math.round(sellerNetAmount * 100);
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: String(payment.currency || "EUR").toLowerCase(),
        destination: connectRow.stripe_account_id,
        source_transaction: chargeId,
        transfer_group: `wetudy_${payment.id}`,
        metadata: {
          wetudy_payment_intent_id: payment.id,
          wetudy_seller_id: payment.seller_id,
          wetudy_private_preview: "true",
        },
      },
      {
        idempotencyKey: `wetudy-transfer-v1:${payment.id}`,
      }
    );

    const now = new Date().toISOString();
    const { data: savedTransfer, error: saveError } = await admin
      .from("commerce_transfers")
      .upsert(
        {
          payment_intent_id: payment.id,
          seller_id: payment.seller_id,
          stripe_account_id: connectRow.stripe_account_id,
          provider_transfer_id: transfer.id,
          amount: sellerNetAmount,
          currency: payment.currency || "EUR",
          status: "released",
          error_code: null,
          metadata: {
            source_charge_id: chargeId,
            provider_payment_intent_id: providerPaymentIntentId,
            transfer_group: transfer.transfer_group || null,
            sandbox_only: true,
          },
          released_at: now,
          updated_at: now,
        },
        { onConflict: "payment_intent_id" }
      )
      .select("*")
      .single();

    if (saveError) throw saveError;

    await admin.from("payment_events").insert({
      payment_intent_id: payment.id,
      event_type: "sandbox_transfer_released",
      provider_event_id: null,
      payload: {
        actor_id: auth.user.id,
        provider_transfer_id: transfer.id,
        amount: sellerNetAmount,
        sandbox_only: true,
      },
    });

    return NextResponse.json({ ok: true, transfer: savedTransfer });
  } catch (error: any) {
    console.error("No se pudo liberar la transferencia test", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo liberar la transferencia test." },
      { status: 500 }
    );
  }
}
