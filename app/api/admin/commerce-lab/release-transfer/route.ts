import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStripeTestMode,
  isPrivateCommercePreviewEnabled,
} from "@/lib/commerce/private-access";
import { createDelayedSellerTransfer } from "@/lib/commerce/stripe-connect";

function toCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export async function POST(request: Request) {
  if (!isPrivateCommercePreviewEnabled()) {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roles?.length) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const paymentId =
    typeof body?.paymentId === "string" ? body.paymentId.trim() : "";

  if (!paymentId) {
    return NextResponse.json({ error: "Falta paymentId." }, { status: 400 });
  }

  try {
    assertStripeTestMode();
    const admin = createAdminClient();

    const { data: payment } = await admin
      .from("payment_intents")
      .select("id, seller_id, status, seller_net_amount, currency, metadata")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }

    if (payment.status !== "succeeded") {
      return NextResponse.json(
        { error: "El pago debe estar succeeded antes de liberar fondos." },
        { status: 409 }
      );
    }

    if (payment.metadata?.delivery_method !== "shipping") {
      return NextResponse.json(
        { error: "El preview de liberación automática solo cubre envíos por ahora." },
        { status: 409 }
      );
    }

    const [{ data: shipment }, { data: connectedAccount }, { data: existingTransfer }] =
      await Promise.all([
        admin
          .from("shipments")
          .select("id, status")
          .eq("payment_intent_id", payment.id)
          .maybeSingle(),
        admin
          .from("commerce_connected_accounts")
          .select("user_id, provider_account_id, onboarding_status, transfers_enabled")
          .eq("user_id", payment.seller_id)
          .maybeSingle(),
        admin
          .from("commerce_transfers")
          .select("id, status, provider_transfer_id")
          .eq("payment_intent_id", payment.id)
          .maybeSingle(),
      ]);

    if (!shipment || shipment.status !== "delivered") {
      return NextResponse.json(
        { error: "El envío debe estar delivered antes de liberar fondos." },
        { status: 409 }
      );
    }

    if (!connectedAccount?.transfers_enabled) {
      return NextResponse.json(
        { error: "La cuenta Connect del vendedor aún no puede recibir transferencias." },
        { status: 409 }
      );
    }

    if (existingTransfer?.status === "released") {
      return NextResponse.json({
        ok: true,
        alreadyReleased: true,
        transferId: existingTransfer.provider_transfer_id,
      });
    }

    if (existingTransfer?.status === "releasing") {
      return NextResponse.json(
        { error: "Ya hay una liberación en curso para este pago." },
        { status: 409 }
      );
    }

    const amountCents = toCents(payment.seller_net_amount);
    const checkoutSessionId = payment.metadata?.stripe_checkout_session_id;

    if (!amountCents || typeof checkoutSessionId !== "string") {
      return NextResponse.json(
        { error: "El pago no contiene importe neto o sesión Stripe válida." },
        { status: 409 }
      );
    }

    let transferRowId = existingTransfer?.id || null;

    if (transferRowId) {
      const { data: locked } = await admin
        .from("commerce_transfers")
        .update({
          status: "releasing",
          release_reason: "shipment_delivered_private_preview",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transferRowId)
        .in("status", ["eligible", "failed"])
        .select("id")
        .maybeSingle();

      if (!locked) {
        return NextResponse.json(
          { error: "El estado de la transferencia ha cambiado." },
          { status: 409 }
        );
      }
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("commerce_transfers")
        .insert({
          payment_intent_id: payment.id,
          seller_id: payment.seller_id,
          connected_account_user_id: connectedAccount.user_id,
          provider: "stripe",
          amount: amountCents / 100,
          currency: payment.currency || "EUR",
          status: "releasing",
          release_reason: "shipment_delivered_private_preview",
          metadata: { sandbox_only: true },
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        if (insertError?.code === "23505") {
          return NextResponse.json(
            { error: "La transferencia ya ha sido iniciada por otra petición." },
            { status: 409 }
          );
        }
        throw insertError || new Error("No se pudo bloquear la transferencia.");
      }

      transferRowId = inserted.id;
    }

    try {
      const stripeTransfer = await createDelayedSellerTransfer({
        paymentId: payment.id,
        checkoutSessionId,
        sellerAccountId: connectedAccount.provider_account_id,
        amountCents,
        currency: payment.currency || "EUR",
        sellerId: payment.seller_id,
      });

      const now = new Date().toISOString();
      await admin
        .from("commerce_transfers")
        .update({
          provider_transfer_id: stripeTransfer.id,
          status: "released",
          released_at: now,
          updated_at: now,
          metadata: {
            sandbox_only: true,
            stripe_transfer_group: stripeTransfer.transfer_group || null,
          },
        })
        .eq("id", transferRowId);

      return NextResponse.json({
        ok: true,
        transferId: stripeTransfer.id,
        amount: amountCents / 100,
        currency: payment.currency || "EUR",
      });
    } catch (stripeError: any) {
      await admin
        .from("commerce_transfers")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          metadata: {
            sandbox_only: true,
            failure: stripeError?.message || "stripe_transfer_failed",
          },
        })
        .eq("id", transferRowId);

      throw stripeError;
    }
  } catch (error: any) {
    console.error("Error liberando transferencia privada", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo liberar la transferencia test." },
      { status: 500 }
    );
  }
}
