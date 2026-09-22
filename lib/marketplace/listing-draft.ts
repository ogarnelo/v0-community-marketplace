export type ListingDraftPayload = {
  title: string;
  description: string;
  selectedCategory: string;
  selectedGradeLevel: string;
  selectedCondition: string;
  price: string;
  originalPrice: string;
  isbn: string;
  author: string;
  publisher: string;
  format: string;
  language: string;
  subject: string;
  specificType: string;
  sizeLabel: string;
  brand: string;
  model: string;
  season: string;
  isDonation: boolean;
};

export type ListingDraftPhoto = {
  url: string;
  path: string;
};

export const EMPTY_LISTING_DRAFT_PAYLOAD: ListingDraftPayload = {
  title: "",
  description: "",
  selectedCategory: "",
  selectedGradeLevel: "",
  selectedCondition: "",
  price: "",
  originalPrice: "",
  isbn: "",
  author: "",
  publisher: "",
  format: "",
  language: "",
  subject: "",
  specificType: "",
  sizeLabel: "",
  brand: "",
  model: "",
  season: "",
  isDonation: false,
};

export function draftDisplayTitle(payload: Partial<ListingDraftPayload> | null | undefined) {
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  return title || "Anuncio sin título";
}
