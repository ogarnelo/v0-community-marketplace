import { createAdminClient } from "@/lib/supabase/admin";

type VelocityActionInput = {
  actionKey: string;
  userId: string;
  eventType:
    | "buyer_pay_accepted_offer"
    | "seller_respond_offer"
    | "buyer_review_counteroffer"
    | "seller_prepare_delivery"
    | "buyer_review_purchase"
    | "chat_to_offer"
    | "follow_up_message";
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  message: string;
  href?: string | null;
  actionLabel?: string | null;
  relatedOfferId?: string | null;
  listingId?: string | null;
  conversationId?: string | null;
  paymentIntentId?: string | null;
  metadata?: Record<string, unknown>;
  notify?: boolean;
};

function hoursSince(value: string | null | undefined) {
  if (!value) return 999999;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 999999;
  return (Date.now() - time) / (1000 * 60 * 60);
}

function priceLabel(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "";
  return `${number.toFixed(2).replace(".", ",")}€`;
}

async function insertVelocityAction(input: VelocityActionInput) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("transaction_velocity_events")
    .select("id, status")
    .eq("action_key", input.actionKey)
    .maybeSingle();

  if (existing?.id) return false;

  const { error } = await admin.from("transaction_velocity_events").insert({
    action_key: input.actionKey,
    user_id: input.userId,
    related_offer_id: input.relatedOfferId || null,
    listing_id: input.listingId || null,
    conversation_id: input.conversationId || null,
    payment_intent_id: input.paymentIntentId || null,
    event_type: input.eventType,
    priority: input.priority,
    status: "pending",
    title: input.title,
    message: input.message,
    href: input.href || null,
    action_label: input.actionLabel || null,
    metadata: input.metadata || {},
  });

  if (error) {
    console.error("transaction_velocity_action_insert_error", error);
    return false;
  }

  if (input.notify) {
    await admin.from("notifications").insert({
      user_id: input.userId,
      kind: "transaction_velocity",
      title: input.title,
      body: input.message,
      href: input.href || "/account/transactions",
      metadata: {
        action_key: input.actionKey,
        event_type: input.eventType,
        listing_id: input.listingId,
        offer_id: input.relatedOfferId,
        source: "transaction_velocity",
      },
    });
  }

  return true;
}

async function loadListingMap(listingIds: string[]) {
  const admin = createAdminClient();
  if (listingIds.length === 0) return new Map<string, any>();

  const { data } = await admin
    .from("listings")
    .select("id, title, seller_id, status")
    .in("id", listingIds);

  return new Map((data || []).map((listing: any) => [listing.id, listing]));
}

async function loadPaymentMap(offerIds: string[]) {
  const admin = createAdminClient();
  if (offerIds.length === 0) return new Map<string, any[]>();

  const { data } = await admin
    .from("payment_intents")
    .select("id, offer_id, listing_id, buyer_id, seller_id, status, amount, created_at")
    .in("offer_id", offerIds);

  const map = new Map<string, any[]>();

  for (const payment of data || []) {
    const list = map.get(payment.offer_id) || [];
    list.push(payment);
    map.set(payment.offer_id, list);
  }

  return map;
}

function hasActiveOrPaidPayment(payments: any[]) {
  return payments.some((payment) =>
    ["paid", "processing", "requires_payment_method", "requires_action"].includes(payment.status)
  );
}

function hasPaidPayment(payments: any[]) {
  return payments.some((payment) => payment.status === "paid");
}

export async function runTransactionVelocityRules() {
  const admin = createAdminClient();
  const createdActions: string[] = [];

  const { data: offers, error: offersError } = await admin
    .from("listing_offers")
    .select("id, listing_id, buyer_id, seller_id, offered_price, counter_price, status, created_at, responded_at")
    .in("status", ["pending", "countered", "accepted"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (offersError) {
    return {
      ok: false,
      message: offersError.message,
      createdActions: 0,
    };
  }

  const listingIds = [...new Set((offers || []).map((offer: any) => offer.listing_id).filter(Boolean))];
  const offerIds = [...new Set((offers || []).map((offer: any) => offer.id).filter(Boolean))];

  const [listingMap, paymentMap] = await Promise.all([
    loadListingMap(listingIds),
    loadPaymentMap(offerIds),
  ]);

  for (const offer of offers || []) {
    const listing = listingMap.get(offer.listing_id);
    const listingTitle = listing?.title || "tu anuncio";
    const payments = paymentMap.get(offer.id) || [];
    const amount = priceLabel(offer.counter_price || offer.offered_price);
    const offerHref = `/checkout/${offer.id}`;
    const activityHref = "/account/transactions";

    if (offer.status === "accepted" && offer.buyer_id && !hasActiveOrPaidPayment(payments)) {
      const age = hoursSince(offer.responded_at || offer.created_at);
      const priority = age >= 24 ? "urgent" : age >= 6 ? "high" : "medium";

      const created = await insertVelocityAction({
        actionKey: `buyer-pay-accepted-offer:${offer.id}`,
        userId: offer.buyer_id,
        eventType: "buyer_pay_accepted_offer",
        priority,
        title: "Tu oferta ha sido aceptada",
        message: amount
          ? `Completa el pago de ${amount} para "${listingTitle}" antes de que el producto deje de estar reservado.`
          : `Completa el pago para "${listingTitle}" antes de que el producto deje de estar reservado.`,
        href: offerHref,
        actionLabel: "Pagar ahora",
        relatedOfferId: offer.id,
        listingId: offer.listing_id,
        metadata: {
          offer_status: offer.status,
          age_hours: Math.round(age),
        },
        notify: age >= 2,
      });

      if (created) createdActions.push(`buyer-pay-accepted-offer:${offer.id}`);
    }

    if (offer.status === "accepted" && offer.seller_id && !hasPaidPayment(payments)) {
      const age = hoursSince(offer.responded_at || offer.created_at);
      if (age >= 12) {
        const created = await insertVelocityAction({
          actionKey: `seller-waiting-payment:${offer.id}`,
          userId: offer.seller_id,
          eventType: "follow_up_message",
          priority: age >= 48 ? "high" : "medium",
          title: "Pago pendiente de comprador",
          message: `La oferta aceptada para "${listingTitle}" aún no aparece como pagada. Mantén el chat activo y evita reservar indefinidamente.`,
          href: activityHref,
          actionLabel: "Ver operación",
          relatedOfferId: offer.id,
          listingId: offer.listing_id,
          metadata: {
            age_hours: Math.round(age),
          },
          notify: age >= 24,
        });

        if (created) createdActions.push(`seller-waiting-payment:${offer.id}`);
      }
    }

    if (offer.status === "pending" && offer.seller_id) {
      const age = hoursSince(offer.created_at);
      if (age >= 4) {
        const created = await insertVelocityAction({
          actionKey: `seller-respond-pending-offer:${offer.id}`,
          userId: offer.seller_id,
          eventType: "seller_respond_offer",
          priority: age >= 24 ? "urgent" : age >= 12 ? "high" : "medium",
          title: "Tienes una oferta pendiente",
          message: amount
            ? `Responde la oferta de ${amount} por "${listingTitle}". Responder rápido aumenta la probabilidad de venta.`
            : `Responde la oferta pendiente por "${listingTitle}". Responder rápido aumenta la probabilidad de venta.`,
          href: activityHref,
          actionLabel: "Responder oferta",
          relatedOfferId: offer.id,
          listingId: offer.listing_id,
          metadata: {
            age_hours: Math.round(age),
          },
          notify: age >= 12,
        });

        if (created) createdActions.push(`seller-respond-pending-offer:${offer.id}`);
      }
    }

    if (offer.status === "countered" && offer.buyer_id) {
      const age = hoursSince(offer.responded_at || offer.created_at);
      if (age >= 4) {
        const created = await insertVelocityAction({
          actionKey: `buyer-review-counteroffer:${offer.id}`,
          userId: offer.buyer_id,
          eventType: "buyer_review_counteroffer",
          priority: age >= 24 ? "high" : "medium",
          title: "Tienes una contraoferta pendiente",
          message: amount
            ? `Revisa la contraoferta de ${amount} para "${listingTitle}".`
            : `Revisa la contraoferta para "${listingTitle}".`,
          href: activityHref,
          actionLabel: "Ver contraoferta",
          relatedOfferId: offer.id,
          listingId: offer.listing_id,
          metadata: {
            age_hours: Math.round(age),
          },
          notify: age >= 12,
        });

        if (created) createdActions.push(`buyer-review-counteroffer:${offer.id}`);
      }
    }
  }

  const { data: recentConversations } = await admin
    .from("conversations")
    .select("id, listing_id, buyer_id, seller_id, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  for (const conversation of recentConversations || []) {
    const age = hoursSince(conversation.created_at);
    if (age < 8 || age > 96) continue;

    const { data: conversationOffers } = await admin
      .from("listing_offers")
      .select("id")
      .eq("listing_id", conversation.listing_id)
      .eq("buyer_id", conversation.buyer_id)
      .limit(1);

    if (conversationOffers && conversationOffers.length > 0) continue;

    const listing = listingMap.get(conversation.listing_id);
    const listingTitle = listing?.title || "este anuncio";

    const created = await insertVelocityAction({
      actionKey: `chat-to-offer:${conversation.id}`,
      userId: conversation.buyer_id,
      eventType: "chat_to_offer",
      priority: "low",
      title: "¿Quieres hacer una oferta?",
      message: `Si "${listingTitle}" te interesa, puedes hacer una oferta para cerrar la operación antes.`,
      href: `/messages/${conversation.id}`,
      actionLabel: "Abrir chat",
      conversationId: conversation.id,
      listingId: conversation.listing_id,
      metadata: {
        age_hours: Math.round(age),
      },
      notify: false,
    });

    if (created) createdActions.push(`chat-to-offer:${conversation.id}`);
  }

  return {
    ok: true,
    createdActions: createdActions.length,
    createdActionKeys: createdActions.slice(0, 50),
    generatedAt: new Date().toISOString(),
  };
}
