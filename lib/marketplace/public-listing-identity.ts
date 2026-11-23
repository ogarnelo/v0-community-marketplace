import type { MarketplaceListing } from "@/lib/types/marketplace";

/** Public listing IDs are permalink IDs, not seller or private-school UUIDs. */
export function projectListingForViewer(
  listing: MarketplaceListing,
  verifiedUserId: string | null | undefined,
): MarketplaceListing {
  return verifiedUserId ? listing : {
    ...listing,
    sellerId: null,
    schoolId: null,
    directorySchoolCode: null,
  };
}
