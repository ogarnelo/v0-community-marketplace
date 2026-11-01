import { categories, conditions, gradeLevels } from "@/lib/mock-data";

export type WhatsappStep =
  | "idle" | "title" | "description" | "condition"
  | "intent" | "price" | "grade" | "review" | "published";

export type WhatsappDraft = {
  listingId?: string;
  title?: string;
  description?: string;
  category?: string;
  gradeLevel?: string;
  condition?: string;
  kind?: "sale" | "donation";
  price?: number | null;
};

export type WhatsappState = {
  step: WhatsappStep;
  payload: WhatsappDraft;
  draftPhotoPath: string | null;
};

export type WhatsappNext = {
  state: WhatsappState;
  response: string;
  publish?: true;
  cleanup?: true;
};

const LONG_DESCRIPTION_LIMIT = 750;
const CONDITION_PROMPT = [
  "¿En qué estado se encuentra? Responde con un número:",
  ...conditions.map((item, index) => `${index + 1}. ${item.label}`),
].join("\n");
const GRADE_PROMPT = "¿Para qué curso es? Escríbelo como en Wetudy (ejemplo: 3o ESO, 2o Primaria, Universidad).";
const TITLE_PROMPT = "Confirma el título respondiendo SI, o escribe uno nuevo (mínimo 12 caracteres).";
const INTENT_PROMPT = "¿Quieres venderlo o donarlo? Responde 1 para VENDER o 2 para DONAR.";
const NO_PHOTO_REPLY = "Envíame una foto de un artículo para iniciar un anuncio. Escribe CANCELAR si quieres descartar el borrador actual.";
const CONDITION_VALUES = conditions.map((item) => item.value);
const requiresGrade = (category?: string) =>
  category === "Libros de texto" || category === "Lectura y literatura";

export function isValidWhatsappDraft(draft: WhatsappDraft, photoPath: string | null) {
  return Boolean(
    photoPath &&
    draft.listingId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(draft.listingId) &&
    draft.title && draft.title.trim().length >= 12 && draft.title.length <= 110 &&
    draft.description && draft.description.trim().length >= 40 && draft.description.length <= LONG_DESCRIPTION_LIMIT &&
    draft.category && categories.includes(draft.category) &&
    draft.condition && CONDITION_VALUES.includes(draft.condition as (typeof CONDITION_VALUES)[number]) &&
    (!requiresGrade(draft.category) || (draft.gradeLevel && gradeLevels.includes(draft.gradeLevel))) &&
    (draft.kind === "donation" ||
      (draft.kind === "sale" && typeof draft.price === "number" &&
        Number.isFinite(draft.price) && draft.price > 0 && draft.price <= 10000))
  );
}

export function startWhatsappListing(
  listingId: string,
  photoPath: string,
  suggestion: { title: string | null; description: string | null; category: string | null; gradeLevel: string | null }
): WhatsappNext {
  const title = (suggestion.title || "").trim().slice(0, 110);
  const description = (suggestion.description || "").trim().slice(0, LONG_DESCRIPTION_LIMIT);
  const category = categories.includes(suggestion.category || "") ? suggestion.category! : "Otros";
  const gradeLevel = gradeLevels.includes(suggestion.gradeLevel || "") ? suggestion.gradeLevel! : undefined;
  const state: WhatsappState = {
    step: "title",
    payload: { listingId, title, description, category, gradeLevel },
    draftPhotoPath: photoPath,
  };
  return {
    state,
    response: `📷 Foto recibida. He preparado un borrador (no publicado):\n\n${title || "[Título por completar]"}\nCategoría: ${category}\n\n${TITLE_PROMPT}\n\nNo compartas datos personales. Escribe CANCELAR en cualquier momento.`,
  };
}

export function formatWhatsappReview(draft: WhatsappDraft) {
  const condition = conditions.find((c) => c.value === draft.condition)?.label || "Sin indicar";
  const price = draft.kind === "donation" ? "Donación gratuita" : `${draft.price?.toFixed(2)} €`;
  return [
    "📝 Revisa tu anuncio:",
    `Título: ${draft.title}`,
    `Descripción: ${draft.description}`,
    `Categoría: ${draft.category}`,
    `Curso: ${draft.gradeLevel || "Varios cursos"}`,
    `Estado: ${condition}`,
    `Modalidad: ${price}`,
    "",
    "Responde PUBLICAR para confirmar, EDITAR para corregir o CANCELAR para descartar.",
    "No se publicará nada sin que escribas PUBLICAR.",
  ].join("\n");
}

function normalizeGrade(input: string) {
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[º°]/g, "o").replace(/\s+/g, " ").trim().toLowerCase();
  return gradeLevels.find((grade) => norm(grade) === norm(input));
}

export function advanceWhatsappListing(state: WhatsappState, incoming: string): WhatsappNext {
  const input = incoming.trim().slice(0, 1000);
  const upper = input.toLocaleUpperCase("es-ES");
  if (upper === "CANCELAR") {
    return { state: { step: "idle", payload: {}, draftPhotoPath: null }, response: "Borrador descartado. Envíame otra foto cuando quieras.", cleanup: Boolean(state.draftPhotoPath) };
  }

  if (state.step === "idle" || state.step === "published" || !state.draftPhotoPath) {
    return { state, response: NO_PHOTO_REPLY };
  }

  const draft = { ...state.payload };
  if (state.step === "title") {
    if (upper !== "SI" && upper !== "SÍ") draft.title = input.slice(0, 110);
    if (!draft.title || draft.title.trim().length < 12) return { state, response: TITLE_PROMPT };
    if (!draft.description || draft.description.length < 40) {
      return { state: { ...state, step: "description", payload: draft }, response: "Describe el artículo en al menos 40 caracteres (sin datos personales). ¿Qué incluye?" };
    }
    return { state: { ...state, step: "condition", payload: draft }, response: CONDITION_PROMPT };
  }

  if (state.step === "description") {
    if (input.length < 40 || input.length > LONG_DESCRIPTION_LIMIT) {
      return { state, response: "Escribe una descripción de entre 40 y 750 caracteres." };
    }
    draft.description = input;
    return { state: { ...state, step: "condition", payload: draft }, response: CONDITION_PROMPT };
  }

  if (state.step === "condition") {
    const index = Number(input);
    if (!/^[1-5]$/.test(input) || !conditions[index - 1]) return { state, response: CONDITION_PROMPT };
    draft.condition = conditions[index - 1].value;
    return { state: { ...state, step: "intent", payload: draft }, response: INTENT_PROMPT };
  }

  if (state.step === "intent") {
    if (input !== "1" && input !== "2") return { state, response: INTENT_PROMPT };
    draft.kind = input === "1" ? "sale" : "donation";
    draft.price = null;
    if (draft.kind === "sale") {
      return { state: { ...state, step: "price", payload: draft }, response: "¿Qué precio quieres poner? Escribe una cantidad en euros (ejemplo: 12 o 12,50)." };
    }
    if (requiresGrade(draft.category) && !draft.gradeLevel) {
      return { state: { ...state, step: "grade", payload: draft }, response: GRADE_PROMPT };
    }
    return { state: { ...state, step: "review", payload: draft }, response: formatWhatsappReview(draft) };
  }

  if (state.step === "price") {
    if (!/^\d{1,5}(?:[.,]\d{1,2})?$/.test(input)) return { state, response: "Indica un precio válido en euros, superior a 0 (ejemplo: 12,50)." };
    const amount = Number(input.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return { state, response: "El precio debe estar entre 0,01 € y 10.000 €." };
    }
    draft.price = amount;
    if (requiresGrade(draft.category) && !draft.gradeLevel) {
      return { state: { ...state, step: "grade", payload: draft }, response: GRADE_PROMPT };
    }
    return { state: { ...state, step: "review", payload: draft }, response: formatWhatsappReview(draft) };
  }

  if (state.step === "grade") {
    const grade = normalizeGrade(input);
    if (!grade) return { state, response: GRADE_PROMPT };
    draft.gradeLevel = grade;
    return { state: { ...state, step: "review", payload: draft }, response: formatWhatsappReview(draft) };
  }

  if (state.step === "review") {
    if (upper === "EDITAR") {
      return { state: { ...state, step: "title" }, response: `Escribe un nuevo título o responde SI para mantener "${draft.title}". Después podrás revisar los otros datos.` };
    }
    if (upper !== "PUBLICAR") {
      return { state, response: "Responde PUBLICAR para confirmar el anuncio, EDITAR para cambiar datos o CANCELAR para descartarlo." };
    }
    if (!isValidWhatsappDraft(draft, state.draftPhotoPath)) {
      return { state, response: "No puedo publicar porque faltan datos. Escribe EDITAR para revisarlos." };
    }
    return { state, response: "Publicación confirmada por el usuario.", publish: true };
  }
  return { state, response: NO_PHOTO_REPLY };
}
