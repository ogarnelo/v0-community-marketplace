const INTERNAL_ORIGIN = "https://wetudy.internal";

export function getSafeInternalPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);

    if (parsed.origin !== INTERNAL_ORIGIN) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
