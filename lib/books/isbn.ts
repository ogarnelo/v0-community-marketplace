export type NormalizedIsbn = {
  canonicalIsbn: string;
  isbn10: string | null;
  isbn13: string;
};

export function stripIsbnFormatting(value: string) {
  return value.replace(/[^0-9xX]/g, "").toUpperCase();
}

export function isValidIsbn10(value: string) {
  const clean = stripIsbnFormatting(value);
  if (!/^\d{9}[\dX]$/.test(clean)) return false;

  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const char = clean[index];
    const digit = char === "X" ? 10 : Number(char);
    if (!Number.isFinite(digit)) return false;
    sum += digit * (10 - index);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(value: string) {
  const clean = stripIsbnFormatting(value);
  if (!/^\d{13}$/.test(clean)) return false;

  const expected = Number(clean[12]);
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(clean[index]) * (index % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === expected;
}

export function isbn10To13(value: string) {
  const clean = stripIsbnFormatting(value);
  if (!isValidIsbn10(clean)) return null;

  const body = `978${clean.slice(0, 9)}`;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(body[index]) * (index % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${body}${check}`;
}

export function normalizeIsbn(value: string): NormalizedIsbn | null {
  const clean = stripIsbnFormatting(value);

  if (isValidIsbn13(clean)) {
    return { canonicalIsbn: clean, isbn10: null, isbn13: clean };
  }

  if (isValidIsbn10(clean)) {
    const isbn13 = isbn10To13(clean);
    if (!isbn13) return null;
    return { canonicalIsbn: isbn13, isbn10: clean, isbn13 };
  }

  return null;
}

export function extractIsbnFromText(value: string): NormalizedIsbn | null {
  const candidates = value.match(/[0-9Xx][0-9Xx\s-]{8,22}[0-9Xx]/g) || [];

  for (const candidate of candidates) {
    const normalized = normalizeIsbn(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function isValidIsbn(value: string) {
  return normalizeIsbn(value) !== null;
}
