import { categories, conditions, gradeLevels } from "@/lib/mock-data";
import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn";
import {
  detailFieldsForCategory, normalizeDetailChoice, promptForDetail,
  type WhatsappDetailKey,
} from "@/lib/whatsapp/category-fields";

export type WhatsappStep =
  | "idle" | "category" | "title" | "description" | "details"
  | "grade" | "condition" | "intent" | "price" | "originalPrice"
  | "review" | "published";

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
  detailIndex?: number;
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

export type WhatsappNext = {
  state: WhatsappState;
  response: string;
  publish?: true;
  cleanup?: true;
};

const DESCRIPTION_LIMIT = 750;
const PRICE_LIMIT = 10000;
const CONDITION_PROMPT = [
  "¿En qué estado REAL está el artículo? Responde con un número:",
  ...conditions.map((item, index) => `${index + 1}. ${item.label}`),
].join("\n");
const INTENT_PROMPT = "¿Quieres venderlo o donarlo? Responde 1 para VENDER o 2 para DONAR.";
const GRADE_PROMPT = "¿Para qué curso o etapa es? Escríbelo como en Wetudy (ej. 3o ESO, 2o Primaria, Universidad). Si ya hay un curso sugerido, responde SI para confirmarlo.";
const TITLE_PROMPT = "¿Confirmas el título? Responde SI o escribe uno nuevo (mínimo 12 caracteres).";
const DESCRIPTION_PROMPT =
  "Revisa la descripción propuesta. Responde SI para aceptarla o escribe una nueva de 40 a 750 caracteres. Indica los componentes incluidos o sus detalles, pero evita datos personales.";
const NO_PHOTO_REPLY = "Envíame una fotografía del artículo para iniciar un anuncio. Escribe CANCELAR para descartar cualquier borrador.";
const CONDITION_VALUES = conditions.map((item) => item.value);
const DETAIL_KEYS: WhatsappDetailKey[] = ["isbn", "subject", "author", "publisher", "format", "language", "specificType", "sizeLabel", "season", "brand", "model"];
const requiresGrade = (category?: string) =>
  category === "Libros de texto" || category === "Lectura y literatura";

function normalizeGrade(input: string) {
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[º°]/g, "o").replace(/\s+/g, " ").trim().toLowerCase();
  return gradeLevels.find((grade) => norm(grade) === norm(input));
}

function normalizeCategory(input: string) {
  const text = input.trim();
  if (/^\d{1,2}$/.test(text)) {
    const index = Number(text) - 1;
    return categories[index];
  }
  return categories.find((category) =>
    category.toLocaleLowerCase("es-ES") === text.toLocaleLowerCase("es-ES"));
}

function safeText(input: unknown, limit: number) {
  return typeof input === "string" ? input.trim().slice(0, limit) : "";
}

function categoryPrompt(category?: string) {
  return [
    "¿Qué categoría corresponde al artículo?",
    ...(category ? [`Sugerencia: ${category}. Responde SI para confirmarla.`] : []),
    ...categories.map((item, i) => `${i + 1}. ${item}`),
    "Responde SI o con el número de la categoría correcta.",
  ].join("\n");
}

function descriptionPrompt(description?: string) {
  return [`Descripción propuesta:\n${description || "(sin descripción suficiente)"}`, DESCRIPTION_PROMPT].join("\n\n");
}

function nextAfterDetails(draft: WhatsappDraft): WhatsappNext {
  const needsGrade = requiresGrade(draft.category);
  if (needsGrade || draft.gradeLevel) {
    return {
      state: { step: "grade", payload: draft, draftPhotoPath: "" },
      response: `${GRADE_PROMPT}${!needsGrade ? "\nSi no corresponde a un curso concreto, escribe OMITIR." : ""}\n${draft.gradeLevel ? `Sugerido: ${draft.gradeLevel}` : ""}`,
    };
  }
  return { state: { step: "condition", payload: draft, draftPhotoPath: "" }, response: CONDITION_PROMPT };
}

function nextDetail(draft: WhatsappDraft): WhatsappNext {
  const fields = detailFieldsForCategory(draft.category);
  const index = draft.detailIndex ?? 0;
  if (index < fields.length) {
    const current = fields[index];
    const value = draft[current.key];
    return {
      state: { step: "details", payload: draft, draftPhotoPath: "" },
      response: promptForDetail(current, typeof value === "string" ? value : undefined),
    };
  }
  return nextAfterDetails(draft);
}

function keepPhoto(previous: WhatsappState, next: WhatsappNext): WhatsappNext {
  return { ...next, state: { ...next.state, draftPhotoPath: previous.draftPhotoPath } };
}

export function isValidWhatsappDraft(draft: WhatsappDraft, photoPath: string | null) {
  if (!(photoPath && draft.listingId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(draft.listingId) &&
    draft.title && draft.title.trim().length >= 12 && draft.title.length <= 110 &&
    draft.description && draft.description.trim().length >= 40 && draft.description.length <= DESCRIPTION_LIMIT &&
    draft.category && categories.includes(draft.category) &&
    draft.condition && CONDITION_VALUES.includes(draft.condition as (typeof CONDITION_VALUES)[number]) &&
    (!requiresGrade(draft.category) || (draft.gradeLevel && gradeLevels.includes(draft.gradeLevel))) &&
    (draft.kind === "donation" ||
      (draft.kind === "sale" && typeof draft.price === "number" &&
       Number.isFinite(draft.price) && draft.price > 0 && draft.price <= PRICE_LIMIT)))) {
    return false;
  }
  if (draft.gradeLevel && !gradeLevels.includes(draft.gradeLevel)) return false;
  if (draft.originalPrice != null &&
      (!Number.isFinite(draft.originalPrice) || draft.originalPrice < 0 || draft.originalPrice > PRICE_LIMIT)) return false;
  if (draft.isbn && !isValidIsbn(draft.isbn)) return false;

  const fields = detailFieldsForCategory(draft.category);
  for (const key of DETAIL_KEYS) {
    const value = draft[key];
    if (!value) continue;
    const matching = fields.find((field) => field.key === key);
    if (!matching || value.length > matching.limit) return false;
    if (matching.options && !matching.options.includes(value)) return false;
  }
  return true;
}

export function startWhatsappListing(
  listingId: string,
  photoPath: string,
  suggestion: WhatsappSuggestion
): WhatsappNext {
  const category = categories.includes(suggestion.category || "") ? suggestion.category! : undefined;
  const gradeLevel = gradeLevels.includes(suggestion.gradeLevel || "") ? suggestion.gradeLevel! : undefined;
  const draft: WhatsappDraft = {
    listingId, title: safeText(suggestion.title, 110),
    description: safeText(suggestion.description, DESCRIPTION_LIMIT),
    category, gradeLevel, detailIndex: 0,
  };
  for (const key of DETAIL_KEYS) {
    const value = suggestion[key];
    const target = detailFieldsForCategory(category).find((field) => field.key === key);
    if (!value || !target) continue;
    const safe = safeText(value, target.limit);
    if (key === "isbn" && !isValidIsbn(safe)) continue;
    if (target.options && !target.options.includes(safe)) continue;
    draft[key] = key === "isbn" ? normalizeIsbn(safe)?.canonicalIsbn || safe : safe;
  }
  const suggestedDetails = detailFieldsForCategory(category)
    .filter((field) => Boolean(draft[field.key]))
    .map((field) => `${field.label}: ${draft[field.key]}`);
  return {
    state: { step: "category", payload: draft, draftPhotoPath: photoPath },
    response: [
      "📷 He preparado esta propuesta de anuncio (BORRADOR, sin publicar):",
      "",
      `📦 Título: ${draft.title || "[pendiente]"}`,
      `📝 Descripción: ${draft.description || "[pendiente]"}`,
      `🏷️ Categoría: ${category || "[pendiente]"}`,
      ...(gradeLevel ? [`🎓 Curso sugerido: ${gradeLevel}`] : []),
      ...suggestedDetails.map((detail) => `🔎 ${detail}`),
      "",
      "¿Son correctos la categoría, el título y la descripción?",
      "SI — aceptar los tres y revisar solo los datos pendientes.",
      "EDITAR — corregir título o descripción.",
      "CAMBIAR — elegir otra categoría.",
      "CANCELAR — descartar.",
      "Tu respuesta SI no publica nada. El anuncio solo se publicará con una confirmación final PUBLICAR.",
    ].join("\\n"),
  };
}

export function formatWhatsappReview(draft: WhatsappDraft) {
  const condition = conditions.find((c) => c.value === draft.condition)?.label || "Sin indicar";
  const price = draft.kind === "donation" ? "Donación gratuita" : `${draft.price?.toFixed(2)} €`;
  const details = detailFieldsForCategory(draft.category)
    .filter((field) => Boolean(draft[field.key]))
    .map((field) => `${field.label}: ${draft[field.key]}`);
  return [
    "📝 FICHA COMPLETA — Revisa los datos antes de publicar:",
    `Título: ${draft.title}`,
    `Descripción: ${draft.description}`,
    `Categoría: ${draft.category}`,
    `Curso: ${draft.gradeLevel || "Varios cursos"}`,
    ...details,
    `Estado: ${condition}`,
    `Modalidad: ${price}`,
    ...(draft.kind === "sale" && draft.originalPrice != null
      ? [`Precio original: ${draft.originalPrice.toFixed(2)} €`] : []),
    "",
    "Responde PUBLICAR para confirmar, EDITAR para corregir o CANCELAR para descartar.",
    "Nada se publica sin tu confirmación.",
  ].join("\n");
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
  if (state.step === "category") {
    if (upper === "CAMBIAR") {
      return { state, response: categoryPrompt(draft.category) };
    }
    if (upper === "EDITAR") {
      if (!draft.category) return { state, response: categoryPrompt() };
      return {
        state: { ...state, step: "title", payload: draft },
        response: `Título propuesto: ${draft.title || "(sin título)"}\\n\\n${TITLE_PROMPT}`,
      };
    }

    const selected = upper === "SI" || upper === "SÍ" ? draft.category : normalizeCategory(input);
    if (!selected) return { state, response: categoryPrompt(draft.category) };
    if (selected !== draft.category) {
      draft.category = selected;
      draft.gradeLevel = undefined;
      for (const key of DETAIL_KEYS) delete draft[key];
      // Category changes can invalidate AI descriptions: require an explicit
      // second review instead of silently accepting the old suggestion.
      return {
        state: { ...state, step: "title", payload: draft },
        response: `Categoría actualizada a ${selected}. Revisa el título: ${draft.title || "(sin título)"}\\n\\n${TITLE_PROMPT}`,
      };
    }
    if (!draft.title || draft.title.trim().length < 12) {
      return {
        state: { ...state, step: "title", payload: draft },
        response: `Falta confirmar el título. ${TITLE_PROMPT}`,
      };
    }
    if (!draft.description || draft.description.trim().length < 40) {
      return {
        state: { ...state, step: "description", payload: draft },
        response: descriptionPrompt(draft.description),
      };
    }
    // One SI accepts the proposed category/title/description together.
    // Specific details and the final explicit PUBLICAR remain separate.
    draft.detailIndex = 0;
    return keepPhoto(state, nextDetail(draft));
  }

  if (state.step === "title") {
    if (upper !== "SI" && upper !== "SÍ") draft.title = input.slice(0, 110);
    if (!draft.title || draft.title.trim().length < 12) return { state, response: TITLE_PROMPT };
    return { state: { ...state, step: "description", payload: draft }, response: descriptionPrompt(draft.description) };
  }

  if (state.step === "description") {
    if (upper !== "SI" && upper !== "SÍ") draft.description = input.slice(0, DESCRIPTION_LIMIT);
    if (!draft.description || draft.description.trim().length < 40) {
      return { state, response: `La descripción necesita al menos 40 caracteres.\n\n${descriptionPrompt(draft.description)}` };
    }
    draft.detailIndex = 0;
    return keepPhoto(state, nextDetail(draft));
  }

  if (state.step === "details") {
    const fields = detailFieldsForCategory(draft.category);
    const index = draft.detailIndex ?? 0;
    const field = fields[index];
    if (!field) return keepPhoto(state, nextAfterDetails(draft));
    if (upper === "OMITIR TODO") {
      for (const remaining of fields.slice(index)) delete draft[remaining.key];
      draft.detailIndex = fields.length;
      return keepPhoto(state, nextAfterDetails(draft));
    }
    if (upper === "OMITIR") {
      delete draft[field.key];
    } else if (upper === "SI" || upper === "SÍ") {
      if (!draft[field.key]) return { state, response: promptForDetail(field) };
    } else {
      const value = normalizeDetailChoice(field, input);
      if (!value) return { state, response: `No reconozco ese valor.\n${promptForDetail(field, draft[field.key])}` };
      if (field.key === "isbn") {
        if (!isValidIsbn(value)) return { state, response: "El ISBN no supera la validación. Escribe uno válido o responde OMITIR." };
        draft.isbn = normalizeIsbn(value)?.canonicalIsbn || value;
      } else {
        draft[field.key] = value;
      }
    }
    draft.detailIndex = index + 1;
    return keepPhoto(state, nextDetail(draft));
  }

  if (state.step === "grade") {
    if (upper === "OMITIR" && !requiresGrade(draft.category)) {
      draft.gradeLevel = undefined;
    } else if ((upper === "SI" || upper === "SÍ") && draft.gradeLevel) {
      // User explicitly confirms the course proposed from a photo.
    } else {
      const grade = normalizeGrade(input);
      if (!grade) return { state, response: GRADE_PROMPT };
      draft.gradeLevel = grade;
    }
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
    draft.originalPrice = null;
    if (draft.kind === "sale") {
      return { state: { ...state, step: "price", payload: draft }, response: "¿Qué precio quieres poner? Escribe un importe en euros (ejemplo: 12 o 12,50)." };
    }
    return { state: { ...state, step: "review", payload: draft }, response: formatWhatsappReview(draft) };
  }

  if (state.step === "price" || state.step === "originalPrice") {
    if (state.step === "originalPrice" && upper === "OMITIR") {
      draft.originalPrice = null;
      return { state: { ...state, step: "review", payload: draft }, response: formatWhatsappReview(draft) };
    }
    if (!/^\d{1,5}(?:[.,]\d{1,2})?$/.test(input)) {
      return { state, response: "Indica una cantidad válida en euros (ejemplo: 12,50) o, si es el precio original, responde OMITIR." };
    }
    const amount = Number(input.replace(",", "."));
    if (!Number.isFinite(amount) || amount > PRICE_LIMIT || (state.step === "price" && amount <= 0)) {
      return { state, response: "Introduce un precio permitido (venta: más de 0 €, máximo 10.000 €)." };
    }
    if (state.step === "price") {
      draft.price = amount;
      return { state: { ...state, step: "originalPrice", payload: draft }, response: "¿Recuerdas su precio original? Es un dato opcional. Escribe un importe en € o responde OMITIR." };
    }
    draft.originalPrice = amount;
    return { state: { ...state, step: "review", payload: draft }, response: formatWhatsappReview(draft) };
  }

  if (state.step === "review") {
    if (upper === "EDITAR") {
      return { state: { ...state, step: "category", payload: draft }, response: categoryPrompt(draft.category) };
    }
    if (upper !== "PUBLICAR") {
      return { state, response: "Responde PUBLICAR para confirmar, EDITAR para corregir o CANCELAR para descartar." };
    }
    if (!isValidWhatsappDraft(draft, state.draftPhotoPath)) {
      return { state, response: "No puedo publicar porque faltan datos. Escribe EDITAR para revisarlos." };
    }
    return { state, response: "Publicación confirmada por el usuario.", publish: true };
  }
  return { state, response: NO_PHOTO_REPLY };
}
