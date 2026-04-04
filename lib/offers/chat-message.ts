export type OfferRealtimeStatus = 'pending' | 'countered';

const OFFER_PREFIX = '💰 OFERTA|';

export function buildOfferChatBody(params: {
  offerId: string;
  amount: number;
  status: OfferRealtimeStatus;
}) {
  const safeAmount = Number(params.amount);
  return `${OFFER_PREFIX}${params.status}|${params.offerId}|${Number.isFinite(safeAmount) ? safeAmount : 0}`;
}

export function parseOfferChatBody(body?: string | null): {
  offerId: string;
  amount: number;
  status: OfferRealtimeStatus;
} | null {
  if (!body || !body.startsWith(OFFER_PREFIX)) return null;

  const raw = body.slice(OFFER_PREFIX.length);
  const [status, offerId, amountRaw] = raw.split('|');

  if (!offerId || (status !== 'pending' && status !== 'countered')) {
    return null;
  }

  const amount = Number(amountRaw);

  return {
    offerId,
    amount: Number.isFinite(amount) ? amount : 0,
    status,
  };
}

export function getOfferChatPreview(body?: string | null) {
  const parsed = parseOfferChatBody(body);
  if (!parsed) return body || "";
  return parsed.status === "countered" ? `💰 Contraoferta: ${parsed.amount} €` : `💰 Oferta enviada: ${parsed.amount} €`;
}
