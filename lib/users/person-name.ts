export function normalizeNamePart(value?: string | null) {
  return (value || "").trim().replace(/\s+/g, " ");
}

export function buildFullName(firstName?: string | null, lastName?: string | null) {
  const normalizedFirstName = normalizeNamePart(firstName);
  const normalizedLastName = normalizeNamePart(lastName);
  const fullName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");
  return fullName || null;
}

export function splitLegacyFullName(fullName?: string | null) {
  const normalized = normalizeNamePart(fullName);
  if (!normalized) return { firstName: "", lastName: "" };

  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName: firstName || "",
    lastName: rest.join(" "),
  };
}
