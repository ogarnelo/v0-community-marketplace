export function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

export function cloneTitle(title: string, suffix = "copia") {
  const clean = normalizeText(title);
  const base = clean.replace(/\s+\(copia.*?\)$/i, "");
  return `${base} (${suffix})`.slice(0, 120);
}

export function packTitleFromListings(listings: Array<{ title?: string | null; grade_level?: string | null; category?: string | null }>) {
  const firstGrade = listings.find((listing) => listing.grade_level)?.grade_level;
  const firstCategory = listings.find((listing) => listing.category)?.category;

  if (firstGrade && firstCategory) return `Pack ${firstCategory} · ${firstGrade}`.slice(0, 120);
  if (firstGrade) return `Pack educativo · ${firstGrade}`.slice(0, 120);
  if (firstCategory) return `Pack ${firstCategory}`.slice(0, 120);
  return "Pack educativo".slice(0, 120);
}

export function packDescriptionFromListings(listings: Array<{ title?: string | null; description?: string | null; price?: number | null }>) {
  const lines = listings.map((listing, index) => {
    const price = typeof listing.price === "number" ? ` · ${listing.price.toFixed(2)}€` : "";
    return `${index + 1}. ${listing.title || "Producto"}${price}`;
  });

  return [
    "Pack creado desde varios anuncios de Wetudy.",
    "",
    "Incluye:",
    ...lines,
    "",
    "Antes de comprar, confirma por chat el estado exacto de cada producto.",
  ].join("\n");
}

export function suggestedPackPrice(listings: Array<{ price?: number | null }>) {
  const total = listings.reduce((sum, listing) => {
    const price = Number(listing.price || 0);
    return Number.isFinite(price) ? sum + price : sum;
  }, 0);

  if (total <= 0) return null;

  return Math.max(0, Math.round(total * 0.9 * 100) / 100);
}

export function variationIdeasForListing(listing: {
  title?: string | null;
  category?: string | null;
  grade_level?: string | null;
  condition?: string | null;
  price?: number | null;
}) {
  const title = normalizeText(listing.title || "Producto");
  const category = normalizeText(listing.category || "");
  const grade = normalizeText(listing.grade_level || "");
  const price = Number(listing.price || 0);

  const ideas = [
    {
      title: `${title} · lote familiar`.slice(0, 120),
      description: "Agrupa varios productos similares para aumentar valor percibido y reducir fricción de compra.",
      price: Number.isFinite(price) && price > 0 ? Math.round(price * 1.8 * 100) / 100 : null,
    },
    {
      title: `${title} · opción económica`.slice(0, 120),
      description: "Publica una alternativa más barata si tienes otra unidad con más uso o menor estado.",
      price: Number.isFinite(price) && price > 0 ? Math.max(1, Math.round(price * 0.8 * 100) / 100) : null,
    },
    {
      title: grade ? `${category || title} para ${grade}`.slice(0, 120) : `${category || title} recomendado`.slice(0, 120),
      description: "Crea una variación con título más orientado a curso/categoría para mejorar búsqueda interna.",
      price: Number.isFinite(price) && price > 0 ? price : null,
    },
  ];

  return ideas;
}
