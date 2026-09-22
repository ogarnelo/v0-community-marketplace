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
        "id, buyer_id, seller_id, status, amount, buyer_fee_amount, shipping_amount, seller_net_amount, platform_fee_amount, currency, provider_payment_intent_id, metadata"
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

    const { data: existingRefund } = await admin
      .from("commerce_refunds")
      .select("id, status, provider_refund_id")
      .eq("payment_intent_id", payment.id)
      .maybeSingle();

    if (existingRefund) {
      return NextResponse.json(
        { error: "Existe un refund registrado para este pago; no se pueden liberar fondos." },
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

    const { chargeId, providerPaymentIntentId, paymentIntent } =
      await resolveStripePaymentIntentAndCharge({
        providerPaymentIntentId: payment.provider_payment_intent_id,
        checkoutSessionId,
      });

    const itemAmount = Number(payment.amount || 0);
    const buyerFeeAmount = Number(payment.buyer_fee_amount || 0);
    const shippingAmount = Number(payment.shipping_amount || 0);
    const expectedTotalAmount = itemAmount + buyerFeeAmount + shippingAmount;
    const expectedTotalCents = Math.round(expectedTotalAmount * 100);
    const amountCents = Math.round(sellerNetAmount * 100);
    const expectedCurrency = String(payment.currency || "EUR").toLowerCase();

    if (
      !Number.isFinite(expectedTotalAmount) ||
      expectedTotalAmount <= 0 ||
      expectedTotalCents <= 0
    ) {
      return NextResponse.json(
        { error: "El total esperado del pago no es válido." },
        { status: 409 }
      );
    }

    if (
      paymentIntent.status !== "succeeded" ||
      paymentIntent.amount_received !== expectedTotalCents ||
      paymentIntent.currency !== expectedCurrency
    ) {
      return NextResponse.json(
        { error: "Stripe y Supabase no coinciden en estado, importe o moneda del pago." },
        { status: 409 }
      );
    }

    if (amountCents <= 0 || amountCents > expectedTotalCents) {
      return NextResponse.json(
        { error: "El neto del vendedor no es compatible con el total cobrado." },
        { status: 409 }
      );
    }

    const transferGroup =
      paymentIntent.transfer_group || `wetudy_${payment.id}`;

    // Reconcile Stripe before creating anything. This closes the case where
    // Stripe succeeded but the following Supabase write failed, including a
    // retry after Stripe's idempotency-key retention window.
    const priorTransfers = await stripe.transfers.list({
      transfer_group: transferGroup,
      destination: connectRow.stripe_account_id,
      limit: 100,
    });
    const stripeExistingTransfer = priorTransfers.data.find(
      (candidate) =>
        candidate.metadata?.wetudy_payment_intent_id === payment.id
    );

    if (stripeExistingTransfer) {
      const existingSourceTransaction =
        typeof stripeExistingTransfer.source_transaction === "string"
          ? stripeExistingTransfer.source_transaction
          : stripeExistingTransfer.source_transaction?.id || null;

      if (
        stripeExistingTransfer.amount_reversed > 0 &&
        !stripeExistingTransfer.reversed
      ) {
        return NextResponse.json(
          {
            error:
              "Stripe contiene una reversión parcial de esta transferencia; se requiere reconciliación manual.",
          },
          { status: 409 }
        );
      }

      if (
        stripeExistingTransfer.amount !== amountCents ||
        stripeExistingTransfer.currency !== expectedCurrency ||
        existingSourceTransaction !== chargeId
      ) {
        return NextResponse.json(
          { error: "Stripe ya contiene una transferencia incompatible para este pago." },
          { status: 409 }
        );
      }

      const reconciledAt = new Date().toISOString();
      const { data: reconciledTransfer, error: reconcileError } = await admin
        .from("commerce_transfers")
        .upsert(
          {
            payment_intent_id: payment.id,
            seller_id: payment.seller_id,
            stripe_account_id: connectRow.stripe_account_id,
            provider_transfer_id: stripeExistingTransfer.id,
            amount: sellerNetAmount,
            currency: payment.currency || "EUR",
            status: stripeExistingTransfer.reversed ? "reversed" : "released",
            error_code: null,
            metadata: {
              source_charge_id: chargeId,
              provider_payment_intent_id: providerPaymentIntentId,
              transfer_group: transferGroup,
              reconciled_from_stripe: true,
              sandbox_only: true,
            },
            released_at: reconciledAt,
            reversed_at: stripeExistingTransfer.reversed ? reconciledAt : null,
            updated_at: reconciledAt,
          },
          { onConflict: "payment_intent_id" }
        )
        .select("*")
        .single();

      if (reconcileError) throw reconcileError;

      return NextResponse.json({
        ok: true,
        transfer: reconciledTransfer,
        existing: true,
        reconciled: true,
      });
    }

    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: expectedCurrency,
        destination: connectRow.stripe_account_id,
        source_transaction: chargeId,
        transfer_group: transferGroup,
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
            transfer_group: transfer.transfer_group || transferGroup,
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
