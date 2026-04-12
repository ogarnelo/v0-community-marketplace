export type ListingStatus = "available" | "reserved" | "sold" | "archived";

export type ListingType = "sale" | "donation";

export type ListingRow = {
  id: string;
  title: string | null;
  description?: string | null;
  category: string | null;
  grade_level: string | null;
  condition: string | null;
  type: string | null;
  listing_type?: string | null;
  isbn?: string | null;
  price: number | null;
  original_price?: number | null;
  estimated_retail_price?: number | null;
  seller_id: string | null;
  user_id?: string | null;
  school_id?: string | null;
  postal_code?: string | null;
  status: string | null;
  created_at?: string | null;
};

export type ListingPhotoRow = {
  id: string;
  listing_id: string;
  url: string;
  sort_order: number | null;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  user_type: string | null;
  school_id?: string | null;
  grade_level?: string | null;
  postal_code?: string | null;
  business_name?: string | null;
  business_description?: string | null;
  website?: string | null;
  is_business_verified?: boolean | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_region?: string | null;
  shipping_country_code?: string | null;
  phone?: string | null;
  created_at?: string | null;
};

export type ReviewRow = {
  rating: number;
  comment?: string | null;
  created_at?: string | null;
  reviewer_id?: string | null;
  reviewed_user_id?: string | null;
  listing_id?: string | null;
};

export type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  postal_code?: string | null;
};

export type MarketplaceListing = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  gradeLevel: string | null;
  condition: string | null;
  type: string | null;
  isbn?: string | null;
  price?: number;
  originalPrice?: number;
  photos: string[];
  sellerId: string | null;
  schoolId: string | null;
  status: string | null;
  createdAt: string | null;
  distance?: number;
  isFavorite?: boolean;
};

export type ConversationSummary = {
  id: string;
  otherName: string;
  listingTitle: string;
  latestMessageBody: string;
  latestMessageCreatedAt: string | null;
  unreadCount: number;
};

export type AccountProfileRow = {
  id: string;
  full_name: string | null;
  user_type: string | null;
  grade_level: string | null;
  postal_code: string | null;
  school_id: string | null;
  business_name?: string | null;
  business_description?: string | null;
  website?: string | null;
  is_business_verified?: boolean | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_region?: string | null;
  shipping_country_code?: string | null;
  phone?: string | null;
  created_at: string | null;
};

export type ListingOfferRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  offered_price: number;
  current_amount?: number | null;
  current_actor?: string | null;
  rounds_count?: number | null;
  accepted_amount?: number | null;
  status: string | null;
  counter_price: number | null;
  created_at: string | null;
  responded_at: string | null;
};

export type ListingOfferEventRow = {
  id: string;
  offer_id: string;
  conversation_id: string | null;
  actor_id: string;
  actor_role: string | null;
  event_type: string;
  amount: number | null;
  round_number: number | null;
  status_snapshot: string | null;
  created_at: string | null;
};

export type DonationRequestRow = {
  id: string;
  listing_id: string | null;
  requester_id: string | null;
  assigned_to_requester_id: string | null;
  approved_by_admin_id: string | null;
  status: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
  school_id: string | null;
};

export type DonationRequestEventRow = {
  id: string;
  request_id: string;
  conversation_id: string | null;
  actor_id: string;
  event_type: string;
  note: string | null;
  status_snapshot: string | null;
  created_at: string | null;
};

export type PaymentIntentRow = {
  id: string;
  offer_id?: string | null;
  listing_id?: string | null;
  conversation_id?: string | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  amount: number | null;
  currency?: string | null;
  provider?: string | null;
  provider_payment_intent_id?: string | null;
  status: string | null;
  platform_fee_amount?: number | null;
  buyer_fee_amount?: number | null;
  shipping_amount?: number | null;
  seller_net_amount?: number | null;
  shipment_tier?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ShipmentRow = {
  id: string;
  payment_intent_id?: string | null;
  listing_id?: string | null;
  conversation_id?: string | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  provider?: string | null;
  service_code?: string | null;
  shipment_tier?: string | null;
  status?: string | null;
  shipping_amount?: number | null;
  tracking_code?: string | null;
  tracking_url?: string | null;
  label_url?: string | null;
  provider_shipment_id?: string | null;
  payload?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function buildPhotosMap(rows: ListingPhotoRow[]) {
  const grouped = new Map<string, string[]>();

  for (const row of rows) {
    if (!grouped.has(row.listing_id)) {
      grouped.set(row.listing_id, []);
    }

    grouped.get(row.listing_id)?.push(row.url);
  }

  return grouped;
}
