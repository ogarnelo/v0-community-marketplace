import type { ListingType } from "@/lib/types/marketplace";

type ListingTypeSource = {
  type?: string | null;
  listing_type?: string | null;
};

export function getNormalizedListingType(source?: ListingTypeSource | null): ListingType {
  const raw = source?.listing_type || source?.type || null;
  return raw === "donation" ? "donation" : "sale";
}

type ListingWriteBase = {
  title: string;
  description: string;
  category: string;
  grade_level: string;
  condition: string;
  price: number | null;
  original_price: number | null;
  seller_id?: string;
  school_id?: string | null;
  status?: string;
};

export function buildListingWritePayload(
  data: ListingWriteBase,
  listingType: ListingType
) {
  return {
    ...data,
    type: listingType,
    listing_type: listingType,
  };
}
