export function isSafeInternalRedirectPath(value: string | null | undefined) {
  if (!value) return false;

  const trimmed = value.trim();

  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("\\")) return false;
  if (trimmed.includes("\u0000")) return false;

  try {
    const parsed = new URL(trimmed, "https://wetudy.local");
    return parsed.origin === "https://wetudy.local" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

export function safeInternalRedirectPath(value: string | null | undefined, fallback = "/") {
  return isSafeInternalRedirectPath(value) ? value!.trim() : fallback;
}

export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("\u0000")) return null;

  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    const parsed = new URL(withProtocol);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    if (!parsed.hostname || parsed.username || parsed.password) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function displayExternalUrl(value: string | null | undefined) {
  const safe = safeExternalUrl(value);
  if (!safe) return null;

  try {
    const parsed = new URL(safe);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return safe;
  }
}
