export type DemoListingCandidate = {
  id?: string | null;
  title?: string | null;
};

const DEMO_ID_PREFIX = "d0000000-0000-4000-8000-";

export function isDemoListing(listing: DemoListingCandidate) {
  const id = listing.id?.trim().toLowerCase() || "";
  const title = listing.title?.trim() || "";

  return id.startsWith(DEMO_ID_PREFIX) || /^demo\s*[·:—-]/i.test(title);
}
