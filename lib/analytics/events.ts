export const MarketplaceEvents = {
  ListingViewed: "listing_viewed",
  ListingCreated: "listing_created",
  ListingShared: "listing_shared",
  FavoriteAdded: "favorite_added",
  ChatStarted: "chat_started",
  OfferCreated: "offer_created",
  OfferAccepted: "offer_accepted",
  CheckoutStarted: "checkout_started",
  PaymentCompleted: "payment_completed",
  SearchSaved: "search_saved",
  FollowCreated: "follow_created",
  BoostStarted: "boost_started",
  BoostPaid: "boost_paid",
  IssueOpened: "issue_opened",
  ReviewSubmitted: "review_submitted",
  OnboardingCompleted: "onboarding_completed",
  CourseMaterialCreated: "course_material_created",
} as const;

export type MarketplaceEventName =
  (typeof MarketplaceEvents)[keyof typeof MarketplaceEvents];

export type TrackEventPayload = {
  eventName: MarketplaceEventName | string;
  entityType?: string;
  entityId?: string;
  properties?: Record<string, unknown>;
};
