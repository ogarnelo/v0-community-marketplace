import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStripeTestMode,
  isPrivateCommercePreviewEnabled,
} from "@/lib/commerce/private-access";
import { stripe } from "@/lib/stripe";
import { resolveStripePaymentIntentAndCharge } from "@/lib/commerce/settlement";

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
        "id, buyer_id, seller_id, status, amount, buyer_fee_amount, shipping_amount, currency, provider_payment_intent_id, metadata"
      )
      .eq("id", paymentIntentId)
      .maybeSingle();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }

    if (payment.status === "refunded") {
      const { data: existingRefund } = await admin
        .from("commerce_refunds")
        .select("*")
        .eq("payment_intent_id", payment.id)
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        refund: existingRefund,
        existing: true,
      });
    }

    if (payment.status !== "succeeded") {
      return NextResponse.json(
        { error: "Solo se puede reembolsar un pago confirmado." },
        { status: 409 }
      );
    }

    const { data: existingRefund } = await admin
      .from("commerce_refunds")
      .select("*")
      .eq("payment_intent_id", payment.id)
      .maybeSingle();

    if (existingRefund?.status === "succeeded") {
      return NextResponse.json({ ok: true, refund: existingRefund, existing: true });
    }

    const totalAmount =
      Number(payment.amount || 0) +
      Number(payment.buyer_fee_amount || 0) +
      Number(payment.shipping_amount || 0);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { error: "El importe total del pago no es válido." },
        { status: 409 }
      );
    }

    const expectedAmountCents = Math.round(totalAmount * 100);
    const expectedCurrency = String(payment.currency || "EUR").toLowerCase();
    const checkoutSessionId =
      typeof payment.metadata?.stripe_checkout_session_id === "string"
        ? payment.metadata.stripe_checkout_session_id
        : null;

    const { providerPaymentIntentId, chargeId, paymentIntent } =
      await resolveStripePaymentIntentAndCharge({
        providerPaymentIntentId: payment.provider_payment_intent_id,
        checkoutSessionId,
      });

    if (
      paymentIntent.status !== "succeeded" ||
      paymentIntent.amount_received !== expectedAmountCents ||
      paymentIntent.currency !== expectedCurrency
    ) {
      return NextResponse.json(
        { error: "Stripe y Supabase no coinciden en estado, importe o moneda del pago." },
        { status: 409 }
      );
    }

    const charge = await stripe.charges.retrieve(chargeId);
    if (
      charge.amount !== expectedAmountCents ||
      charge.currency !== expectedCurrency
    ) {
      return NextResponse.json(
        { error: "El cargo Stripe no coincide con el pago registrado." },
        { status: 409 }
      );
    }

    const { data: transfer } = await admin
      .from("commerce_transfers")
      .select("*")
      .eq("payment_intent_id", payment.id)
      .maybeSingle();

    let providerReversalId =
      typeof transfer?.provider_reversal_id === "string"
        ? transfer.provider_reversal_id
        : null;

    const ensureTransferReversed = async () => {
      if (!transfer?.provider_transfer_id) return;

      const providerTransfer = await stripe.transfers.retrieve(
        transfer.provider_transfer_id
      );

      if (
        providerTransfer.amount_reversed > 0 &&
        providerTransfer.amount_reversed < providerTransfer.amount
      ) {
        throw new Error(
          "La transferencia tiene una reversión parcial en Stripe y requiere reconciliación manual."
        );
      }

      if (
        providerTransfer.reversed ||
        providerTransfer.amount_reversed >= providerTransfer.amount
      ) {
        providerReversalId =
          providerReversalId || providerTransfer.reversals?.data?.[0]?.id || null;
      } else {
        const reversal = await stripe.transfers.createReversal(
          transfer.provider_transfer_id,
          {},
          {
            idempotencyKey: "wetudy-transfer-reversal-v1:" + payment.id,
          }
        );
        providerReversalId = reversal.id;
      }

      const reversalNow = new Date().toISOString();
      const { error: transferUpdateError } = await admin
        .from("commerce_transfers")
        .update({
          status: "reversed",
          provider_reversal_id: providerReversalId,
          reversed_at: reversalNow,
          updated_at: reversalNow,
        })
        .eq("id", transfer.id);

      if (transferUpdateError) throw transferUpdateError;
    };

    // Reconcile Stripe first. This prevents a second refund if Stripe succeeded
    // but the Supabase write failed, even after an idempotency key expires.
    const providerRefunds = await stripe.refunds.list({
      payment_intent: providerPaymentIntentId,
      limit: 100,
    });
    const stripeExistingRefund = providerRefunds.data.find(
      (candidate) =>
        candidate.metadata?.wetudy_payment_intent_id === payment.id
    );

    let refund = stripeExistingRefund || null;
    let reconciled = Boolean(stripeExistingRefund);

    if (refund) {
      if (
        refund.amount !== expectedAmountCents ||
        refund.currency !== expectedCurrency
      ) {
        return NextResponse.json(
          { error: "Stripe ya contiene un refund incompatible para este pago." },
          { status: 409 }
        );
      }

      if (transfer?.provider_transfer_id) {
        await ensureTransferReversed();
      }
    } else {
      if (charge.amount_refunded !== 0) {
        return NextResponse.json(
          {
            error:
              "El cargo ya tiene un refund ajeno o parcial; se requiere reconciliación manual antes de continuar.",
          },
          { status: 409 }
        );
      }

      if (transfer?.provider_transfer_id) {
        await ensureTransferReversed();
      }

      refund = await stripe.refunds.create(
        {
          payment_intent: providerPaymentIntentId,
          amount: expectedAmountCents,
          metadata: {
            wetudy_payment_intent_id: payment.id,
            wetudy_private_preview: "true",
          },
        },
        {
          idempotencyKey: "wetudy-refund-v1:" + payment.id,
        }
      );

      if (
        refund.amount !== expectedAmountCents ||
        refund.currency !== expectedCurrency
      ) {
        throw new Error("Stripe devolvió un refund con importe o moneda inesperados.");
      }
    }

    const refundSucceeded = refund.status === "succeeded";
    const refundFailed = refund.status === "failed" || refund.status === "canceled";
    const now = new Date().toISOString();

    const { data: savedRefund, error: refundSaveError } = await admin
      .from("commerce_refunds")
      .upsert(
        {
          payment_intent_id: payment.id,
          buyer_id: payment.buyer_id,
          provider_refund_id: refund.id,
          amount: refund.amount / 100,
          currency: refund.currency.toUpperCase(),
          status: refundSucceeded
            ? "succeeded"
            : refundFailed
              ? "failed"
              : "pending",
          transfer_reversal_id: providerReversalId,
          error_code: refund.failure_reason || null,
          metadata: {
            provider_payment_intent_id: providerPaymentIntentId,
            stripe_refund_status: refund.status,
            expected_total_amount: totalAmount,
            reconciled_from_stripe: reconciled,
            sandbox_only: true,
          },
          updated_at: now,
        },
        { onConflict: "payment_intent_id" }
      )
      .select("*")
      .single();

    if (refundSaveError) throw refundSaveError;

    if (refundSucceeded) {
      const { error: paymentUpdateError } = await admin
        .from("payment_intents")
        .update({ status: "refunded", updated_at: now })
        .eq("id", payment.id)
        .eq("status", "succeeded");

      if (paymentUpdateError) throw paymentUpdateError;

      const { error: shipmentUpdateError } = await admin
        .from("shipments")
        .update({ status: "cancelled", updated_at: now })
        .eq("payment_intent_id", payment.id)
        .in("status", ["draft", "quoted", "label_pending", "label_ready"]);

      if (shipmentUpdateError) throw shipmentUpdateError;
    }

    const { error: eventError } = await admin.from("payment_events").insert({
      payment_intent_id: payment.id,
      event_type: reconciled
        ? "sandbox_refund_reconciled"
        : "sandbox_refund_created",
      provider_event_id: null,
      payload: {
        actor_id: auth.user.id,
        provider_refund_id: refund.id,
        provider_reversal_id: providerReversalId,
        refund_status: refund.status,
        reconciled,
        sandbox_only: true,
      },
    });

    if (eventError) throw eventError;

    return NextResponse.json({
      ok: true,
      refund: savedRefund,
      existing: reconciled,
      reconciled,
    });
  } catch (error: any) {
    console.error("No se pudo reembolsar la operación test", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo reembolsar la operación test." },
      { status: 500 }
    );
  }
}
