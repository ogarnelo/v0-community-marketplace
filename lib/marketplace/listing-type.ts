import type { ListingRow, ListingType } from "@/lib/types/marketplace";

export function getNormalizedListingType(
  input:
    | Pick<ListingRow, "type" | "listing_type">
    | { type?: string | null; listing_type?: string | null }
    | null
    | undefined
): ListingType {
  const rawType = input?.type?.trim().toLowerCase();
  const rawListingType = input?.listing_type?.trim().toLowerCase();
  const resolved = rawType || rawListingType;

  return resolved === "donation" ? "donation" : "sale";
}

export function buildListingWritePayload(type: ListingType) {
  return {
    type,
    listing_type: type,
  } as const;
}