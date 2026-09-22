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

    const { data: transfer } = await admin
      .from("commerce_transfers")
      .select("*")
      .eq("payment_intent_id", payment.id)
      .maybeSingle();

    let providerReversalId =
      typeof transfer?.provider_reversal_id === "string"
        ? transfer.provider_reversal_id
        : null;

    if (transfer?.status === "released" && transfer.provider_transfer_id) {
      const reversal = await stripe.transfers.createReversal(
        transfer.provider_transfer_id,
        {},
        {
          idempotencyKey: `wetudy-transfer-reversal-v1:${payment.id}`,
        }
      );

      providerReversalId = reversal.id;

      const { error: transferUpdateError } = await admin
        .from("commerce_transfers")
        .update({
          status: "reversed",
          provider_reversal_id: reversal.id,
          reversed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transfer.id);

      if (transferUpdateError) throw transferUpdateError;
    }

    const checkoutSessionId =
      typeof payment.metadata?.stripe_checkout_session_id === "string"
        ? payment.metadata.stripe_checkout_session_id
        : null;

    const { providerPaymentIntentId } = await resolveStripePaymentIntentAndCharge({
      providerPaymentIntentId: payment.provider_payment_intent_id,
      checkoutSessionId,
    });

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

    const refund = await stripe.refunds.create(
      {
        payment_intent: providerPaymentIntentId,
        metadata: {
          wetudy_payment_intent_id: payment.id,
          wetudy_private_preview: "true",
        },
      },
      {
        idempotencyKey: `wetudy-refund-v1:${payment.id}`,
      }
    );

    const refundSucceeded = refund.status === "succeeded";
    const now = new Date().toISOString();

    const { data: savedRefund, error: refundSaveError } = await admin
      .from("commerce_refunds")
      .upsert(
        {
          payment_intent_id: payment.id,
          buyer_id: payment.buyer_id,
          provider_refund_id: refund.id,
          amount: totalAmount,
          currency: payment.currency || "EUR",
          status: refundSucceeded ? "succeeded" : "pending",
          transfer_reversal_id: providerReversalId,
          error_code: null,
          metadata: {
            provider_payment_intent_id: providerPaymentIntentId,
            stripe_refund_status: refund.status,
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

      await admin
        .from("shipments")
        .update({ status: "cancelled", updated_at: now })
        .eq("payment_intent_id", payment.id)
        .in("status", ["draft", "quoted", "label_pending", "label_ready"]);
    }

    await admin.from("payment_events").insert({
      payment_intent_id: payment.id,
      event_type: "sandbox_refund_created",
      provider_event_id: null,
      payload: {
        actor_id: auth.user.id,
        provider_refund_id: refund.id,
        provider_reversal_id: providerReversalId,
        refund_status: refund.status,
        sandbox_only: true,
      },
    });

    return NextResponse.json({ ok: true, refund: savedRefund });
  } catch (error: any) {
    console.error("No se pudo reembolsar la operación test", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo reembolsar la operación test." },
      { status: 500 }
    );
  }
}
