export function normalizeDemandText(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return null;

  const text = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || text === "all") return null;

  return text.slice(0, maxLength);
}

export function normalizeDemandOptional(value: unknown, maxLength = 80) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text === "all") return null;
  return text.slice(0, maxLength);
}

export function normalizeIsbn(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (digits.length < 10 || digits.length > 13) return null;
  return digits;
}

export function postalPrefix(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 2 ? digits.slice(0, 2) : null;
}

export function cleanDemandMetadata(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key.length > 40) continue;
    if (typeof value === "string") output[key] = value.slice(0, 160);
    else if (typeof value === "number" && Number.isFinite(value)) output[key] = value;
    else if (typeof value === "boolean") output[key] = value;
  }

  return output;
}
