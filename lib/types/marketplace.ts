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
  created_at?: string | null;
};

export type ReviewRow = {
  rating: number;
  comment?: string | null;
  created_at?: string;
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
  created_at: string | null;
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