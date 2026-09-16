export function normalizeEmailAddress(value?: string | null) {
  const email = value?.trim() || "";
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
