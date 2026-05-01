import ShareButton from "@/components/growth/share-button";
import UrgencyBanner from "@/components/growth/urgency-banner";

export default function ListingGrowthBlock({ listing }: any) {
  return (
    <div className="space-y-3">
      <UrgencyBanner views={listing?.views} />
      <ShareButton listingId={listing.id} />
    </div>
  );
}
