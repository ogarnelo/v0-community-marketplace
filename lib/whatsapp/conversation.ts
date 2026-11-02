import { categories, conditions, gradeLevels } from "@/lib/mock-data";
import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn";
import { detailFieldsForCategory, type WhatsappDetailKey } from "@/lib/whatsapp/category-fields";

export type WhatsappStep = "idle" | "review_photo" | "form" | "published";

export type WhatsappDraft = {
  listingId?: string;
  title?: string;
  description?: string;
  category?: string;
  gradeLevel?: string;
  condition?: string;
  kind?: "sale" | "donation";
  price?: number | null;
  originalPrice?: number | null;
  isbn?: string;
  subject?: string;
  author?: string;
  publisher?: string;
  format?: string;
  language?: string;
  specificType?: string;
  sizeLabel?: string;
  season?: string;
  brand?: string;
  model?: string;
};

export type WhatsappSuggestion = {
  title: string | null;
  description: string | null;
  category: string | null;
  gradeLevel: string | null;
  isbn?: string | null;
  subject?: string | null;
  author?: string | null;
  publisher?: string | null;
  format?: string | null;
  language?: string | null;
  specificType?: string | null;
  sizeLabel?: string | null;
  season?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type WhatsappState = {
  step: WhatsappStep;
  payload: WhatsappDraft;
  draftPhotoPath: string | null;
};

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const DETAIL_KEYS: WhatsappDetailKey[] = [
  "isbn", "subject", "author", "publisher", "format", "language",
  "specificType", "sizeLabel", "season", "brand", "model",
];
const requiresGrade = (category?: string) =>
  category === "Libros de texto" || category === "Lectura y literatura";

export function isValidWhatsappDraft(draft: WhatsappDraft, photoPath: string | null): boolean {
  if (!(photoPath && draft.listingId && UUID.test(draft.listingId) &&
        draft.title && draft.title.trim().length >= 12 && draft.title.length <= 110 &&
        draft.description && draft.description.trim().length >= 40 && draft.description.length <= 750 &&
        draft.category && categories.includes(draft.category) &&
        draft.condition && conditions.some((c) => c.value === draft.condition) &&
        (!requiresGrade(draft.category) ||
          (draft.gradeLevel && gradeLevels.includes(draft.gradeLevel))) &&
        (draft.kind === "donation" ||
          (draft.kind === "sale" && typeof draft.price === "number" &&
           Number.isFinite(draft.price) && draft.price > 0 && draft.price <= 10000)))) {
    return false;
  }
  if (draft.gradeLevel && !gradeLevels.includes(draft.gradeLevel)) return false;
  if (draft.originalPrice != null &&
      (!Number.isFinite(draft.originalPrice) || draft.originalPrice < 0 || draft.originalPrice > 10000)) return false;
  if (draft.isbn && !isValidIsbn(draft.isbn)) return false;
  const fields = detailFieldsForCategory(draft.category);
  for (const key of DETAIL_KEYS) {
    const value = draft[key];
    if (!value) continue;
    const field = fields.find((f) => f.key === key);
    if (!field || value.length > field.limit) return false;
    if (field.options && !field.options.includes(value)) return false;
  }
  return true;
}

// This function never publishes. It only prepares suggested form values.
// Actual publication is exclusively in the authenticated POST /api/whatsapp/draft.
export function startWhatsappListing(
  listingId: string,
  privatePhotoPath: string,
  suggestion: WhatsappSuggestion
): { state: WhatsappState } {
  const category = categories.includes(suggestion.category || "") ? suggestion.category! : undefined;
  const gradeLevel = gradeLevels.includes(suggestion.gradeLevel || "") ? suggestion.gradeLevel! : undefined;
  const draft: WhatsappDraft = {
    listingId,
    category,
    gradeLevel,
    title: typeof suggestion.title === "string" ? suggestion.title.trim().slice(0, 110) : "",
    description: typeof suggestion.description === "string" ? suggestion.description.trim().slice(0, 750) : "",
  };
  for (const key of DETAIL_KEYS) {
    const field = detailFieldsForCategory(category).find((item) => item.key === key);
    const raw = suggestion[key];
    if (!field || typeof raw !== "string") continue;
    const value = raw.trim().slice(0, field.limit);
    if (!value || (field.options && !field.options.includes(value))) continue;
    if (key === "isbn") {
      if (isValidIsbn(value)) draft.isbn = normalizeIsbn(value)?.canonicalIsbn || value;
    } else {
      draft[key] = value;
    }
  }
  return {
    state: {
      step: "form",
      payload: draft,
      draftPhotoPath: privatePhotoPath,
    },
  };
}
