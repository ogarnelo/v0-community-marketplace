
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import {
  buildPaymentFailedEmail,
  buildPaymentPaidEmail,
  sendTransactionalEmail,
} from "@/lib/emails/transactional";

async function releaseListingIfNoActivePayment(supabase: ReturnType<typeof createAdminClient>, offerId: string, listingId: string) {
  const { data: activePayments } = await supabase
    .from("payment_intents")
    .select("id")
    .eq("listing_id", listingId)
    .in("status", ["requires_payment_method", "processing", "paid"])
    .limit(1);

  if (!activePayments || activePayments.length === 0) {
    await supabase.from("listings").update({ status: "available" }).eq("id", listingId).eq("status", "reserved");
  }

  await supabase
    .from("listing_offers")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", offerId);
}

async function loadPaymentContext(supabase: ReturnType<typeof createAdminClient>, offerId: string) {
  const { data: payment } = await supabase
    .from("payment_intents")
    .select("id, listing_id, buyer_id, seller_id, amount, conversation_id")
    .eq("offer_id", offerId)
    .maybeSingle();

  if (!payment) return null;

  const [listingResult, profilesResult] = await Promise.all([
    payment.listing_id ? supabase.from("listings").select("id, title").eq("id", payment.listing_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, full_name").in("id", [payment.buyer_id, payment.seller_id].filter(Boolean)),
  ]);

  const { data: users } = await supabase.auth.admin.listUsers();
  const userById = new Map((users?.users || []).map((item) => [item.id, item]));
  const profileById = new Map(((profilesResult.data || []) as { id: string; full_name: string | null }[]).map((item) => [item.id, item]));

  return {
    payment,
    listingTitle: listingResult.data?.title || "tu anuncio",
    buyerEmail: payment.buyer_id ? userById.get(payment.buyer_id)?.email || null : null,
    sellerEmail: payment.seller_id ? userById.get(payment.seller_id)?.email || null : null,
    buyerName: payment.buyer_id ? profileById.get(payment.buyer_id)?.full_name || "Comprador" : "Comprador",
    sellerName: payment.seller_id ? profileById.get(payment.seller_id)?.full_name || "Vendedor" : "Vendedor",
  };
}

export async function POST(request: Request) {
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Firma no válida." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const offerId = session.metadata?.offer_id;
    const listingId = session.metadata?.listing_id;
    const providerPaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    if (offerId) {
      const { data: currentPi } = await supabase
        .from("payment_intents")
        .select("metadata")
        .eq("offer_id", offerId)
        .maybeSingle();

      await supabase
        .from("payment_intents")
        .update({
          status: "paid",
          provider_payment_intent_id: providerPaymentIntentId,
          metadata: {
            ...(currentPi?.metadata || {}),
            paid_at: now,
            stripe_checkout_session_id: session.id,
          },
          updated_at: now,
        })
        .eq("offer_id", offerId);

      await supabase
        .from("listing_offers")
        .update({ status: "accepted", responded_at: now })
        .eq("id", offerId);

      const context = await loadPaymentContext(supabase, offerId);
      if (context) {
        const href = context.payment.conversation_id ? `/messages/${context.payment.conversation_id}` : "/account/activity";
        const amountLabel = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(context.payment.amount || 0));

        await createNotifications(supabase, [
          {
            user_id: context.payment.buyer_id,
            kind: "payment_paid",
            title: "Pago confirmado",
            body: `Tu compra de ${context.listingTitle} ya está confirmada.`,
            href,
            metadata: { offer_id: offerId, listing_id: context.payment.listing_id },
          },
          {
            user_id: context.payment.seller_id,
            kind: "payment_paid",
            title: "Venta confirmada",
            body: `Has vendido ${context.listingTitle}.`,
            href,
            metadata: { offer_id: offerId, listing_id: context.payment.listing_id },
          },
        ]);

        const buyerEmail = context.buyerEmail;
        const sellerEmail = context.sellerEmail;
        const buyerPayload = buildPaymentPaidEmail({
          role: "buyer",
          listingTitle: context.listingTitle,
          counterpartyName: context.sellerName,
          amountLabel,
          href: `${process.env.NEXT_PUBLIC_SITE_URL || ""}${href}`,
        });
        const sellerPayload = buildPaymentPaidEmail({
          role: "seller",
          listingTitle: context.listingTitle,
          counterpartyName: context.buyerName,
          amountLabel,
          href: `${process.env.NEXT_PUBLIC_SITE_URL || ""}${href}`,
        });

        await Promise.allSettled([
          buyerEmail ? sendTransactionalEmail({ to: buyerEmail, ...buyerPayload }) : Promise.resolve({ ok: false, skipped: true }),
          sellerEmail ? sendTransactionalEmail({ to: sellerEmail, ...sellerPayload }) : Promise.resolve({ ok: false, skipped: true }),
        ]);
      }
    }

    if (listingId) {
      await supabase.from("listings").update({ status: "sold" }).eq("id", listingId);
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const offerId = session.metadata?.offer_id;
    const listingId = session.metadata?.listing_id;

    if (offerId) {
      await supabase
        .from("payment_intents")
        .update({ status: "cancelled", updated_at: now })
        .eq("offer_id", offerId);
    }

    if (offerId && listingId) {
      await releaseListingIfNoActivePayment(supabase, offerId, listingId);
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const offerId = paymentIntent.metadata?.offer_id;
    const listingId = paymentIntent.metadata?.listing_id;

    if (offerId) {
      await supabase
        .from("payment_intents")
        .update({
          status: "failed",
          provider_payment_intent_id: paymentIntent.id,
          updated_at: now,
        })
        .eq("offer_id", offerId);

      const context = await loadPaymentContext(supabase, offerId);
      if (context) {
        const href = context.payment.conversation_id ? `/messages/${context.payment.conversation_id}` : "/account/activity";

        await createNotifications(supabase, [
          {
            user_id: context.payment.buyer_id,
            kind: "payment_failed",
            title: "No se pudo completar el pago",
            body: `Revisa la operación de ${context.listingTitle} para volver a intentarlo.`,
            href,
            metadata: { offer_id: offerId, listing_id: context.payment.listing_id },
          },
        ]);

        if (context.buyerEmail) {
          const payload = buildPaymentFailedEmail({
            listingTitle: context.listingTitle,
            href: `${process.env.NEXT_PUBLIC_SITE_URL || ""}${href}`,
          });
          await Promise.allSettled([sendTransactionalEmail({ to: context.buyerEmail, ...payload })]);
        }
      }
    }

    if (offerId && listingId) {
      await releaseListingIfNoActivePayment(supabase, offerId, listingId);
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;

    if (paymentIntentId) {
      const { data: rows } = await supabase
        .from("payment_intents")
        .select("offer_id, listing_id")
        .eq("provider_payment_intent_id", paymentIntentId)
        .limit(1);

      await supabase
        .from("payment_intents")
        .update({ status: "refunded", updated_at: now })
        .eq("provider_payment_intent_id", paymentIntentId);

      const row = rows?.[0];
      if (row?.listing_id) {
        await supabase.from("listings").update({ status: "available" }).eq("id", row.listing_id).eq("status", "sold");
      }
      if (row?.offer_id) {
        await supabase.from("listing_offers").update({ status: "accepted", responded_at: now }).eq("id", row.offer_id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
