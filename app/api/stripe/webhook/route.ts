import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentFailedEmail, sendPaymentSucceededEmail } from "@/lib/emails/transactional";
import { createSendcloudParcel, isSendcloudConfigured } from "@/lib/logistics/sendcloud";

type PaymentIntentMetadata = Record<string, any> | null | undefined;

async function releaseListingIfNoActivePayment(supabase: any, offerId: string, listingId: string) {
  const { data: activePayments } = await supabase
    .from("payment_intents")
    .select("id")
    .eq("listing_id", listingId)
    .in("status", ["requires_payment_method", "processing", "paid"])
    .limit(1);

  if (!activePayments || activePayments.length === 0) {
    await supabase.from("listings").update({ status: "available" }).eq("id", listingId).eq("status", "reserved");
  }

  await supabase.from("listing_offers").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", offerId);
}

function pickFullName(profile: any, fallbackEmail?: string | null) {
  return profile?.business_name || profile?.full_name || fallbackEmail || "Usuario";
}

function hasCompleteShippingAddress(profile: any) {
  return Boolean(
    profile?.shipping_address_line1 &&
    profile?.shipping_city &&
    profile?.postal_code &&
    profile?.shipping_country_code
  );
}

async function maybeSendPaidEmails(supabase: any, paymentRow: any, listingRow: any) {
  const [buyerResult, sellerResult] = await Promise.all([
    paymentRow?.buyer_id ? supabase.from("profiles").select("full_name, business_name").eq("id", paymentRow.buyer_id).maybeSingle() : Promise.resolve({ data: null }),
    paymentRow?.seller_id ? supabase.from("profiles").select("full_name, business_name").eq("id", paymentRow.seller_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const buyerEmail = paymentRow?.metadata?.buyer_email;
  const sellerEmail = paymentRow?.metadata?.seller_email;
  const listingTitle = listingRow?.title || "Anuncio";
  const amount = Number(paymentRow?.amount || 0);

  const jobs: Promise<any>[] = [];
  if (buyerEmail) {
    jobs.push(
      sendPaymentSucceededEmail({
        to: buyerEmail,
        recipientName: pickFullName(buyerResult.data, buyerEmail),
        listingTitle,
        amount,
        paymentId: paymentRow?.id,
      })
    );
  }
  if (sellerEmail) {
    jobs.push(
      sendPaymentSucceededEmail({
        to: sellerEmail,
        recipientName: pickFullName(sellerResult.data, sellerEmail),
        listingTitle,
        amount,
        paymentId: paymentRow?.id,
      })
    );
  }

  await Promise.allSettled(jobs);
}

async function maybeSendFailedEmail(supabase: any, paymentRow: any, listingRow: any) {
  const buyerEmail = paymentRow?.metadata?.buyer_email;
  if (!buyerEmail) return;

  const { data: buyerProfile } = paymentRow?.buyer_id
    ? await supabase.from("profiles").select("full_name, business_name").eq("id", paymentRow.buyer_id).maybeSingle()
    : { data: null };

  await Promise.allSettled([
    sendPaymentFailedEmail({
      to: buyerEmail,
      recipientName: pickFullName(buyerProfile, buyerEmail),
      listingTitle: listingRow?.title || "Anuncio",
      amount: Number(paymentRow?.amount || 0),
      paymentId: paymentRow?.id,
    }),
  ]);
}

async function ensureShipmentForPaidPayment(supabase: any, paymentRow: any, listingRow: any) {
  const metadata = (paymentRow?.metadata || {}) as PaymentIntentMetadata;
  const deliveryMethod = metadata?.delivery_method;

  if (deliveryMethod !== "shipping") {
    return;
  }

  const { data: existingShipment } = await supabase
    .from("shipments")
    .select("id, provider, provider_shipment_id, status, tracking_code, tracking_url, label_url, payload")
    .eq("payment_intent_id", paymentRow.id)
    .maybeSingle();

  if (existingShipment?.provider_shipment_id || existingShipment?.label_url) {
    return;
  }

  const [buyerProfileResult, sellerProfileResult] = await Promise.all([
    paymentRow?.buyer_id
      ? supabase
        .from("profiles")
        .select("full_name, business_name, postal_code, shipping_address_line1, shipping_address_line2, shipping_city, shipping_region, shipping_country_code, phone")
        .eq("id", paymentRow.buyer_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    paymentRow?.seller_id
      ? supabase
        .from("profiles")
        .select("full_name, business_name, postal_code, shipping_address_line1, shipping_address_line2, shipping_city, shipping_region, shipping_country_code, phone")
        .eq("id", paymentRow.seller_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const buyerProfile = buyerProfileResult.data;
  const sellerProfile = sellerProfileResult.data;

  const baseShipment = {
    payment_intent_id: paymentRow.id,
    listing_id: paymentRow.listing_id,
    conversation_id: paymentRow.conversation_id,
    buyer_id: paymentRow.buyer_id,
    seller_id: paymentRow.seller_id,
    shipment_tier: paymentRow.shipment_tier,
    shipping_amount: paymentRow.shipping_amount,
    updated_at: new Date().toISOString(),
  };

  if (!isSendcloudConfigured() || !hasCompleteShippingAddress(buyerProfile)) {
    await supabase
      .from("shipments")
      .upsert(
        {
          ...baseShipment,
          provider: "manual",
          status: "manual_pending",
          payload: {
            mode: "manual_fallback",
            reason: !isSendcloudConfigured() ? "sendcloud_not_configured" : "missing_recipient_address",
          },
        },
        { onConflict: "payment_intent_id" }
      );
    return;
  }

  try {
    const { data: shipmentRow } = await supabase
      .from("shipments")
      .upsert(
        {
          ...baseShipment,
          provider: "sendcloud",
          status: "preparing_label",
          payload: {
            mode: "sendcloud",
            sender_profile_id: paymentRow.seller_id,
            sender_has_address: hasCompleteShippingAddress(sellerProfile),
          },
        },
        { onConflict: "payment_intent_id" }
      )
      .select("id")
      .single();

    if (!shipmentRow?.id) {
      throw new Error("No se pudo preparar el envío.");
    }

    const shipment = await createSendcloudParcel({
      shipmentId: shipmentRow.id,
      orderNumber: `wetudy-${paymentRow.id}`,
      itemAmount: Number(paymentRow.amount || 0),
      shipmentTier: paymentRow.shipment_tier || "small",
      recipient: {
        name: pickFullName(buyerProfile, paymentRow?.metadata?.buyer_email),
        company_name: buyerProfile?.business_name || null,
        address: buyerProfile?.shipping_address_line1,
        address_2: buyerProfile?.shipping_address_line2 || null,
        city: buyerProfile?.shipping_city,
        postal_code: buyerProfile?.postal_code,
        country: buyerProfile?.shipping_country_code || "ES",
        email: paymentRow?.metadata?.buyer_email || null,
        telephone: buyerProfile?.phone || null,
      },
    });

    await supabase
      .from("shipments")
      .update({
        provider: "sendcloud",
        status: shipment.labelUrl ? "label_created" : "ready_to_ship",
        service_code: shipment.serviceName || null,
        tracking_code: shipment.trackingCode,
        tracking_url: shipment.trackingUrl,
        label_url: shipment.labelUrl,
        provider_shipment_id: shipment.providerShipmentId,
        payload: {
          provider_status: shipment.providerStatus,
          shipping_method_id: shipment.shippingMethodId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipmentRow.id);
  } catch (error: any) {
    await supabase
      .from("shipments")
      .upsert(
        {
          ...baseShipment,
          provider: "manual",
          status: "manual_pending",
          payload: {
            mode: "manual_fallback",
            reason: "sendcloud_error",
            message: error?.message || "No se pudo crear la etiqueta en Sendcloud.",
          },
        },
        { onConflict: "payment_intent_id" }
      );
  }
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

    let paymentRow: any = null;
    let listingRow: any = null;

    if (offerId) {
      const { data: currentPi } = await supabase
        .from("payment_intents")
        .select("id, metadata, buyer_id, seller_id, amount, listing_id, conversation_id, shipping_amount, shipment_tier")
        .eq("offer_id", offerId)
        .maybeSingle();

      const { data: updated } = await supabase
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
        .eq("offer_id", offerId)
        .select("*")
        .single();

      paymentRow = updated || currentPi;

      await supabase
        .from("listing_offers")
        .update({ status: "accepted", responded_at: now })
        .eq("id", offerId);
    }

    if (listingId) {
      const { data } = await supabase.from("listings").update({ status: "sold" }).eq("id", listingId).select("id, title").maybeSingle();
      listingRow = data;
    }

    if (paymentRow) {
      await Promise.allSettled([
        maybeSendPaidEmails(supabase, paymentRow, listingRow),
        ensureShipmentForPaidPayment(supabase, paymentRow, listingRow),
      ]);
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

    let paymentRow: any = null;
    let listingRow: any = null;

    if (offerId) {
      const { data: updated } = await supabase
        .from("payment_intents")
        .update({
          status: "failed",
          provider_payment_intent_id: paymentIntent.id,
          updated_at: now,
        })
        .eq("offer_id", offerId)
        .select("*")
        .single();

      paymentRow = updated;
    }

    if (listingId) {
      const { data } = await supabase.from("listings").select("id, title").eq("id", listingId).maybeSingle();
      listingRow = data;
    }

    if (paymentRow) {
      await Promise.allSettled([maybeSendFailedEmail(supabase, paymentRow, listingRow)]);
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
        .select("id, offer_id, listing_id")
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
      if (row?.id) {
        await supabase
          .from("shipments")
          .update({ status: "cancelled", updated_at: now })
          .eq("payment_intent_id", row.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
