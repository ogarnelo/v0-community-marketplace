export type ModerationSignal = {
  flagType:
    | "external_payment"
    | "external_contact"
    | "suspicious_price"
    | "low_quality"
    | "duplicate_like"
    | "prohibited_term"
    | "spam_pattern";
  severity: "critical" | "high" | "medium" | "low";
  reason: string;
  metadata?: Record<string, unknown>;
};

const EXTERNAL_PAYMENT_TERMS = [
  "bizum",
  "paypal amigos",
  "transferencia directa",
  "pago fuera",
  "fuera de wetudy",
  "pagar por fuera",
];

const EXTERNAL_CONTACT_TERMS = [
  "whatsapp",
  "wasap",
  "telegram",
  "instagram",
  "llamame",
  "llámame",
  "mi numero",
  "mi número",
];

const PROHIBITED_TERMS = [
  "falsificado",
  "replica",
  "réplica",
  "copia exacta",
  "dni",
  "pasaporte",
  "licencia",
];

function normalize(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.find((term) => text.includes(normalize(term)));
}

export function analyzeListingForModeration(listing: any): ModerationSignal[] {
  const signals: ModerationSignal[] = [];

  const title = normalize(listing?.title);
  const description = normalize(listing?.description);
  const combined = `${title} ${description}`;
  const price = Number(listing?.price);

  const externalPayment = includesAny(combined, EXTERNAL_PAYMENT_TERMS);
  if (externalPayment) {
    signals.push({
      flagType: "external_payment",
      severity: "high",
      reason: `El anuncio menciona posible pago externo: ${externalPayment}.`,
      metadata: { term: externalPayment },
    });
  }

  const externalContact = includesAny(combined, EXTERNAL_CONTACT_TERMS);
  if (externalContact) {
    signals.push({
      flagType: "external_contact",
      severity: "medium",
      reason: `El anuncio menciona posible contacto externo: ${externalContact}.`,
      metadata: { term: externalContact },
    });
  }

  const prohibited = includesAny(combined, PROHIBITED_TERMS);
  if (prohibited) {
    signals.push({
      flagType: "prohibited_term",
      severity: "critical",
      reason: `El anuncio contiene un término sensible o prohibido: ${prohibited}.`,
      metadata: { term: prohibited },
    });
  }

  if (Number.isFinite(price) && (price <= 0 || price > 1500)) {
    signals.push({
      flagType: "suspicious_price",
      severity: price > 1500 ? "high" : "medium",
      reason: `Precio potencialmente sospechoso: ${price}.`,
      metadata: { price },
    });
  }

  if (title.length < 8 || description.length < 20) {
    signals.push({
      flagType: "low_quality",
      severity: "low",
      reason: "El anuncio tiene título o descripción demasiado breve.",
      metadata: {
        titleLength: title.length,
        descriptionLength: description.length,
      },
    });
  }

  return signals;
}
