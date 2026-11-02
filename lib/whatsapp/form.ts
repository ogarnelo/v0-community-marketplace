import { categories, conditions, gradeLevels } from "@/lib/mock-data";
import { isValidIsbn } from "@/lib/books/isbn";
import { detailFieldsForCategory } from "@/lib/whatsapp/category-fields";
import { isValidWhatsappDraft, type WhatsappDraft } from "@/lib/whatsapp/conversation";

export const WHATSAPP_FORM_REQUIRED = ["title", "description", "category", "condition", "kind"] as const;

const textValue = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function priceValue(value: unknown) {
  if (value === null || value === "" || value === undefined) return null;
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const number = typeof normalized === "string" || typeof normalized === "number"
    ? Number(normalized) : Number.NaN;
  return Number.isFinite(number) ? number : Number.NaN;
}

export function normalizeWhatsappForm(
  input: unknown,
  listingId: string,
  photoPath: string | null
): { draft: WhatsappDraft; errors: Record<string, string> } {
  const raw = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const category = textValue(raw.category, 90);
  const draft: WhatsappDraft = {
    listingId,
    category,
    title: textValue(raw.title, 110),
    description: textValue(raw.description, 750),
    gradeLevel: textValue(raw.gradeLevel, 60) || undefined,
    condition: textValue(raw.condition, 40) || undefined,
    kind: raw.kind === "sale" || raw.kind === "donation" ? raw.kind : undefined,
    price: raw.kind === "sale" ? priceValue(raw.price) : null,
    originalPrice: raw.kind === "sale" ? priceValue(raw.originalPrice) : null,
  };
  const errors: Record<string, string> = {};
  if (!categories.includes(category)) errors.category = "Selecciona una categoría.";
  if (!draft.title || draft.title.length < 12) errors.title = "Escribe un título de al menos 12 caracteres.";
  if (!draft.description || draft.description.length < 40) errors.description = "La descripción debe tener al menos 40 caracteres.";
  if (!draft.condition || !conditions.some((value) => value.value === draft.condition)) {
    errors.condition = "Indica el estado real del artículo.";
  }
  if (draft.kind !== "sale" && draft.kind !== "donation") errors.kind = "Elige venta o donación.";
  if ((category === "Libros de texto" || category === "Lectura y literatura") &&
      (!draft.gradeLevel || !gradeLevels.includes(draft.gradeLevel))) {
    errors.gradeLevel = "Indica el curso o la etapa de este libro.";
  }
  if (draft.gradeLevel && !gradeLevels.includes(draft.gradeLevel)) {
    errors.gradeLevel = "Selecciona un curso válido.";
  }
  if (draft.kind === "sale" &&
      (draft.price == null || !Number.isFinite(draft.price) || draft.price <= 0 || draft.price > 10000)) {
    errors.price = "El precio debe estar entre 0,01 € y 10.000 €.";
  }
  if (draft.originalPrice != null &&
      (!Number.isFinite(draft.originalPrice) || draft.originalPrice < 0 || draft.originalPrice > 10000)) {
    errors.originalPrice = "Introduce un precio original válido o déjalo vacío.";
  }

  for (const field of detailFieldsForCategory(category)) {
    const value = textValue(raw[field.key], field.limit);
    if (!value) continue;
    if (field.options && !field.options.includes(value)) {
      errors[field.key] = "Selecciona una de las opciones disponibles.";
    } else if (field.key === "isbn" && !isValidIsbn(value)) {
      errors.isbn = "Comprueba el ISBN de 10 o 13 dígitos.";
    } else {
      draft[field.key] = value;
    }
  }
  if (!photoPath) errors.photo = "Falta la fotografía del artículo.";

  if (Object.keys(errors).length === 0 && !isValidWhatsappDraft(draft, photoPath)) {
    errors.form = "Hay datos pendientes de revisar.";
  }
  return { draft, errors };
}
