export function normalizePostalCode(value: string | null | undefined) {
  const normalized = (value || "").replace(/\D/g, "").slice(0, 5);
  return normalized.length === 5 ? normalized : normalized;
}

export function maskPostalCode(value: string | null | undefined) {
  const normalized = normalizePostalCode(value);
  if (normalized.length < 2) return null;
  return `${normalized.slice(0, 2)}xxx`;
}

export function formatApproximateZone(value: string | null | undefined) {
  const masked = maskPostalCode(value);
  return masked ? `Zona aproximada ${masked}` : "Zona aproximada no indicada";
}

export const POSTAL_CODE_PRIVACY_COPY =
  "Usamos el código postal para mostrar anuncios cercanos. No mostramos tu dirección exacta.";
