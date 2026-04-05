export type DonationRealtimeStatus = 'pending' | 'approved' | 'rejected';

const DONATION_PREFIX = '🎁 DONATION|';

export function buildDonationChatBody(params: {
  requestId: string;
  status: DonationRealtimeStatus;
  note?: string | null;
}) {
  const safeNote = typeof params.note === 'string' ? params.note.replace(/\|/g, '/').trim() : '';
  return `${DONATION_PREFIX}${params.status}|${params.requestId}|${safeNote}`;
}

export function parseDonationChatBody(body?: string | null): {
  requestId: string;
  status: DonationRealtimeStatus;
  note: string;
} | null {
  if (!body || !body.startsWith(DONATION_PREFIX)) return null;

  const raw = body.slice(DONATION_PREFIX.length);
  const [status, requestId, ...noteParts] = raw.split('|');

  if (!requestId || (status !== 'pending' && status !== 'approved' && status !== 'rejected')) {
    return null;
  }

  return {
    requestId,
    status,
    note: noteParts.join('|') || '',
  };
}

export function getDonationChatPreview(body?: string | null) {
  const parsed = parseDonationChatBody(body);
  if (!parsed) return body || '';

  switch (parsed.status) {
    case 'approved':
      return '🎁 Donación aceptada';
    case 'rejected':
      return '🎁 Donación rechazada';
    default:
      return '🎁 Solicitud de donación';
  }
}
