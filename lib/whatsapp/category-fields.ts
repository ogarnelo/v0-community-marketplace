import { bookFormats, bookLanguages, categories } from "@/lib/mock-data";

export const whatsappCategoryOptions = categories;

export const whatsappUniformItems = ["Polo o camiseta", "Pantalón", "Falda o pichi", "Chándal", "Sudadera o jersey", "Abrigo", "Calzado", "Ropa deportiva", "Lote completo", "Otros"] as const;
export const whatsappUniformSeasons = ["Todo el año", "Verano", "Invierno", "Deporte", "No aplica"] as const;
export const whatsappSchoolSupplies = ["Papelería", "Material de dibujo", "Material de arte", "Geometría", "Archivadores y carpetas", "Calculadoras básicas", "Lote de material", "Otros"] as const;
export const whatsappTechItems = ["Calculadora científica", "Calculadora gráfica", "Tablet", "Portátil", "E-reader", "Auriculares", "Accesorios", "Otros"] as const;
export const whatsappBagItems = ["Mochila", "Estuche", "Bolsa de deporte", "Carrito", "Otros"] as const;

export type WhatsappDetailKey =
  | "isbn" | "subject" | "author" | "publisher" | "format" | "language"
  | "specificType" | "sizeLabel" | "season" | "brand" | "model";

export type WhatsappDetailField = {
  key: WhatsappDetailKey;
  label: string;
  prompt: string;
  options?: readonly string[];
  limit: number;
};

const field = (
  key: WhatsappDetailKey, label: string, prompt: string,
  limit = 100, options?: readonly string[]
): WhatsappDetailField => ({ key, label, prompt, limit, options });

export const WHATSAPP_DETAIL_FIELDS: Record<string, readonly WhatsappDetailField[]> = {
  "Libros de texto": [
    field("isbn", "ISBN", "ISBN de 10 o 13 dígitos", 20),
    field("subject", "Asignatura", "Asignatura (ej. Matemáticas)", 100),
    field("publisher", "Editorial", "Editorial (ej. SM, Santillana)", 100),
    field("author", "Autor", "Autor del libro", 150),
    field("format", "Formato", "Formato", 60, bookFormats),
    field("language", "Idioma", "Idioma", 60, bookLanguages),
  ],
  "Lectura y literatura": [
    field("isbn", "ISBN", "ISBN de 10 o 13 dígitos", 20),
    field("author", "Autor", "Autor del libro", 150),
    field("publisher", "Editorial", "Editorial", 100),
    field("format", "Formato", "Formato", 60, bookFormats),
    field("language", "Idioma", "Idioma", 60, bookLanguages),
  ],
  "Uniformes": [
    field("specificType", "Tipo de prenda", "Prenda o tipo de uniforme", 80, whatsappUniformItems),
    field("sizeLabel", "Talla", "Talla (ej. 8, 10, M)", 30),
    field("season", "Temporada", "Temporada del uniforme", 60, whatsappUniformSeasons),
  ],
  "Material escolar": [
    field("specificType", "Tipo de material", "Tipo de material escolar", 80, whatsappSchoolSupplies),
  ],
  "Tecnología y calculadoras": [
    field("specificType", "Tipo de dispositivo", "Tipo de dispositivo", 80, whatsappTechItems),
    field("brand", "Marca", "Marca (ej. Casio)", 100),
    field("model", "Modelo", "Modelo exacto (ej. fx-82SP CW)", 100),
  ],
  "Mochilas y estuches": [
    field("specificType", "Tipo de artículo", "Tipo de mochila o accesorio", 80, whatsappBagItems),
    field("brand", "Marca", "Marca del artículo", 100),
  ],
};

export function detailFieldsForCategory(category?: string): readonly WhatsappDetailField[] {
  return category ? WHATSAPP_DETAIL_FIELDS[category] || [] : [];
}

export function normalizeDetailChoice(field: WhatsappDetailField, input: string): string | null {
  const text = input.trim();
  if (text.length === 0 || text.length > field.limit) return null;
  if (!field.options) return text;
  const asNumber = Number(text);
  if (/^\d{1,2}$/.test(text) && asNumber >= 1 && asNumber <= field.options.length) {
    return field.options[asNumber - 1];
  }
  return field.options.find((option) => option.toLocaleLowerCase("es-ES") === text.toLocaleLowerCase("es-ES")) || null;
}

export function promptForDetail(field: WhatsappDetailField, current?: string): string {
  const header = `Detalle recomendado: ${field.prompt}.`;
  const choices = field.options?.map((option, i) => `${i + 1}. ${option}`).join("\n");
  const currentPrompt = current
    ? `He leído «${current}». Responde SI para confirmarlo, escribe otro valor o responde OMITIR.`
    : "Responde con el dato o escribe OMITIR.";
  return [header, choices, currentPrompt, "También puedes escribir OMITIR TODO para saltar los detalles opcionales."].filter(Boolean).join("\n");
}
