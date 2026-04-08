export type OfferEventType =
  | "offer_created"
  | "counter_sent"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type OfferRealtimeStatus = "pending" | "countered" | "accepted" | "rejected" | "withdrawn";
export type OfferActorRole = "buyer" | "seller";

const OFFER_PREFIX_V2 = "💰 OFFER_EVENT|";
const OFFER_PREFIX_LEGACY = "💰 OFERTA|";

export function buildOfferChatBody(params: {
  eventId: string;
  offerId: string;
  eventType: OfferEventType;
  actorRole: OfferActorRole;
  amount: number;
  round: number;
  status: OfferRealtimeStatus;
  currentActor: OfferActorRole | "closed";
}) {
  const safeAmount = Number(params.amount);
  const serialized = [
    params.eventId,
    params.offerId,
    params.eventType,
    params.actorRole,
    Number.isFinite(safeAmount) ? safeAmount.toString() : "0",
    params.round.toString(),
    params.status,
    params.currentActor,
  ].join("|");

  return `${OFFER_PREFIX_V2}${serialized}`;
}

export function parseOfferChatBody(body?: string | null): {
  eventId: string;
  offerId: string;
  eventType: OfferEventType;
  actorRole: OfferActorRole;
  amount: number;
  round: number;
  status: OfferRealtimeStatus;
  currentActor: OfferActorRole | "closed";
  isLegacy: boolean;
} | null {
  if (!body) return null;

  if (body.startsWith(OFFER_PREFIX_V2)) {
    const raw = body.slice(OFFER_PREFIX_V2.length);
    const [eventId, offerId, eventType, actorRole, amountRaw, roundRaw, status, currentActor] = raw.split("|");

    if (
      !eventId ||
      !offerId ||
      !["offer_created", "counter_sent", "accepted", "rejected", "withdrawn"].includes(eventType) ||
      !["buyer", "seller"].includes(actorRole) ||
      !["pending", "countered", "accepted", "rejected", "withdrawn"].includes(status) ||
      !["buyer", "seller", "closed"].includes(currentActor)
    ) {
      return null;
    }

    const amount = Number(amountRaw);
    const round = Number(roundRaw);

    return {
      eventId,
      offerId,
      eventType: eventType as OfferEventType,
      actorRole: actorRole as OfferActorRole,
      amount: Number.isFinite(amount) ? amount : 0,
      round: Number.isFinite(round) ? round : 1,
      status: status as OfferRealtimeStatus,
      currentActor: currentActor as OfferActorRole | "closed",
      isLegacy: false,
    };
  }

  if (body.startsWith(OFFER_PREFIX_LEGACY)) {
    const raw = body.slice(OFFER_PREFIX_LEGACY.length);
    const [status, offerId, amountRaw] = raw.split("|");

    if (!offerId || !["pending", "countered"].includes(status)) {
      return null;
    }

    const amount = Number(amountRaw);

    return {
      eventId: `legacy-${offerId}-${status}`,
      offerId,
      eventType: status === "countered" ? "counter_sent" : "offer_created",
      actorRole: status === "countered" ? "seller" : "buyer",
      amount: Number.isFinite(amount) ? amount : 0,
      round: 1,
      status: status as OfferRealtimeStatus,
      currentActor: status === "countered" ? "buyer" : "seller",
      isLegacy: true,
    };
  }

  return null;
}

export function getOfferChatPreview(body?: string | null) {
  const parsed = parseOfferChatBody(body);
  if (!parsed) return body || "";

  switch (parsed.eventType) {
    case "offer_created":
      return `💰 Oferta: ${parsed.amount} €`;
    case "counter_sent":
      return parsed.actorRole === "seller"
        ? `💰 Contraoferta: ${parsed.amount} €`
        : `💰 Nueva oferta: ${parsed.amount} €`;
    case "accepted":
      return `✅ Oferta aceptada: ${parsed.amount} €`;
    case "rejected":
      return "⛔ Oferta rechazada";
    default:
      return `💰 Oferta: ${parsed.amount} €`;
  }
}
