import type { ListingRow, ListingType } from "@/lib/types/marketplace";

export function normalizeListingType(
  value?: string | null,
  fallbackValue?: string | null
): ListingType {
  const candidate = value ?? fallbackValue;
  return candidate === "donation" ? "donation" : "sale";
}

export function getListingTypeFromRow(
  listing?: Pick<ListingRow, "type" | "listing_type"> | null
): ListingType {
  return normalizeListingType(listing?.listing_type, listing?.type);
}

export function getNormalizedListingType(
  listing?: Pick<ListingRow, "type" | "listing_type"> | null
): ListingType {
  return getListingTypeFromRow(listing);
}

export function buildListingTypeColumns(type: ListingType) {
  return {
    type,
    listing_type: type,
  };
}