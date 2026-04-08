export type DonationEventType = "request_created" | "approved" | "rejected" | "cancelled";
export type DonationRealtimeStatus = "pending" | "approved" | "rejected" | "cancelled";

const DONATION_PREFIX_V2 = "🎁 DONATION_EVENT|";
const DONATION_PREFIX_LEGACY = "🎁 DONATION|";

export function buildDonationChatBody(params: {
  eventId: string;
  requestId: string;
  eventType: DonationEventType;
  status: DonationRealtimeStatus;
  note?: string | null;
}) {
  const safeNote = typeof params.note === "string" ? params.note.replace(/\|/g, "/").trim() : "";
  return `${DONATION_PREFIX_V2}${params.eventId}|${params.requestId}|${params.eventType}|${params.status}|${safeNote}`;
}

export function parseDonationChatBody(body?: string | null): {
  eventId: string;
  requestId: string;
  eventType: DonationEventType;
  status: DonationRealtimeStatus;
  note: string;
  isLegacy: boolean;
} | null {
  if (!body) return null;

  if (body.startsWith(DONATION_PREFIX_V2)) {
    const raw = body.slice(DONATION_PREFIX_V2.length);
    const [eventId, requestId, eventType, status, ...noteParts] = raw.split("|");

    if (
      !eventId ||
      !requestId ||
      !["request_created", "approved", "rejected", "cancelled"].includes(eventType) ||
      !["pending", "approved", "rejected", "cancelled"].includes(status)
    ) {
      return null;
    }

    return {
      eventId,
      requestId,
      eventType: eventType as DonationEventType,
      status: status as DonationRealtimeStatus,
      note: noteParts.join("|") || "",
      isLegacy: false,
    };
  }

  if (body.startsWith(DONATION_PREFIX_LEGACY)) {
    const raw = body.slice(DONATION_PREFIX_LEGACY.length);
    const [status, requestId, ...noteParts] = raw.split("|");

    if (!requestId || !["pending", "approved", "rejected"].includes(status)) {
      return null;
    }

    return {
      eventId: `legacy-${requestId}-${status}`,
      requestId,
      eventType:
        status === "pending" ? "request_created" : status === "approved" ? "approved" : "rejected",
      status: status as DonationRealtimeStatus,
      note: noteParts.join("|") || "",
      isLegacy: true,
    };
  }

  return null;
}

export function getDonationChatPreview(body?: string | null) {
  const parsed = parseDonationChatBody(body);
  if (!parsed) return body || "";

  switch (parsed.eventType) {
    case "approved":
      return "🎁 Donación aceptada";
    case "rejected":
      return "🎁 Donación rechazada";
    default:
      return "🎁 Solicitud de donación";
  }
}
