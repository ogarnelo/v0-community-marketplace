import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildDemandInsights, type DemandInsight } from "@/lib/admin/demand-insights";
import { SCHOOL_BOOK_CO2E_KG } from "@/lib/reports/school-impact-report";

export type SuperAdminReportRange = "30d" | "90d" | "365d" | "total";

type AgreementRow = {
  listing_id: string | null;
  agreement_type: string | null;
  amount: number | null;
  confirmed_at: string | null;
};

type ListingImpactRow = {
  id: string;
  title: string | null;
  category: string | null;
  isbn: string | null;
};

type DemandEventRow = {
  query: string | null;
  isbn_query: string | null;
  category: string | null;
  grade_level: string | null;
  results_count: number | null;
  only_my_community: boolean | null;
  nearby_mode: boolean | null;
  created_at: string;
};

export type SuperAdminReport = {
  range: SuperAdminReportRange;
  periodLabel: string;
  generatedAt: string;
  impact: {
    confirmedReuses: number;
    soldItems: number;
    donatedItems: number;
    circularValue: number;
    reusedBooks: number;
    estimatedAvoidedCo2: number;
    unquantifiedItems: number;
    activeSchools: number;
    totalMembers: number;
    activeListings: number;
    listingViews: number;
  };
  demand: {
    searches: number;
    zeroResultSearches: number;
    communitySearches: number;
    nearbySearches: number;
    savedSearches: number;
    topSignals: DemandInsight[];
  };
};

export function normalizeSuperAdminRange(value?: string | null): SuperAdminReportRange {
  if (value === "30d" || value === "90d" || value === "365d" || value === "total") {
    return value;
  }
  return "90d";
}

export function getSuperAdminRange(range: SuperAdminReportRange, now = new Date()) {
  if (range === "total") {
    return { start: null, end: now, label: "Histórico" };
  }

  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);

  return {
    start,
    end: now,
    label:
      range === "30d"
        ? "Últimos 30 días"
        : range === "90d"
          ? "Últimos 90 días"
          : "Últimos 12 meses",
  };
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSchoolBook(listing: ListingImpactRow | undefined) {
  if (!listing) return false;
  if (listing.isbn?.trim()) return true;
  const text = normalize(`${listing.category || ""} ${listing.title || ""}`);
  return ["libro", "libros", "texto", "lectura", "textbook", "book", "manual"].some(
    (token) => text.includes(token)
  );
}

export async function loadSuperAdminReport(
  range: SuperAdminReportRange
): Promise<SuperAdminReport> {
  const admin = createAdminClient();
  const period = getSuperAdminRange(range);
  const endIso = period.end.toISOString();

  let agreementsQuery = admin
    .from("agreements")
    .select("listing_id, agreement_type, amount, confirmed_at")
    .eq("status", "confirmed")
    .lt("confirmed_at", endIso);

  let viewsQuery = admin
    .from("listing_views")
    .select("id", { count: "exact", head: true })
    .lt("viewed_at", endIso);

  let demandQuery = admin
    .from("marketplace_search_events")
    .select(
      "query, isbn_query, category, grade_level, results_count, only_my_community, nearby_mode, created_at"
    )
    .lt("created_at", endIso)
    .order("created_at", { ascending: false });

  let savedSearchesQuery = admin
    .from("saved_searches")
    .select("id", { count: "exact", head: true })
    .lt("created_at", endIso);

  if (period.start) {
    const startIso = period.start.toISOString();
    agreementsQuery = agreementsQuery.gte("confirmed_at", startIso);
    viewsQuery = viewsQuery.gte("viewed_at", startIso);
    demandQuery = demandQuery.gte("created_at", startIso);
    savedSearchesQuery = savedSearchesQuery.gte("created_at", startIso);
  }

  const [
    agreementsResult,
    activeSchoolsResult,
    profilesResult,
    activeListingsResult,
    viewsResult,
    demandResult,
    savedSearchesResult,
  ] = await Promise.all([
    agreementsQuery.returns<AgreementRow[]>(),
    admin
      .from("schools")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .in("status", ["available", "reserved"]),
    viewsQuery,
    demandQuery.returns<DemandEventRow[]>(),
    savedSearchesQuery,
  ]);

  for (const result of [
    agreementsResult,
    activeSchoolsResult,
    profilesResult,
    activeListingsResult,
    viewsResult,
    demandResult,
    savedSearchesResult,
  ]) {
    if (result.error) throw result.error;
  }

  const agreements = agreementsResult.data || [];
  const listingIds = Array.from(
    new Set(
      agreements
        .map((agreement) => agreement.listing_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const listingResult =
    listingIds.length > 0
      ? await admin
          .from("listings")
          .select("id, title, category, isbn")
          .in("id", listingIds)
          .returns<ListingImpactRow[]>()
      : { data: [] as ListingImpactRow[], error: null };

  if (listingResult.error) throw listingResult.error;

  const listingById = new Map(
    (listingResult.data || []).map((listing) => [listing.id, listing])
  );

  const donatedItems = agreements.filter(
    (agreement) => agreement.agreement_type === "donation"
  ).length;
  const soldItems = agreements.length - donatedItems;
  const circularValue = agreements.reduce(
    (sum, agreement) =>
      agreement.agreement_type !== "donation" && typeof agreement.amount === "number"
        ? sum + agreement.amount
        : sum,
    0
  );
  const reusedBooks = agreements.filter((agreement) =>
    agreement.listing_id ? isSchoolBook(listingById.get(agreement.listing_id)) : false
  ).length;

  const demandEvents = demandResult.data || [];
  const zeroResultSearches = demandEvents.filter(
    (event) => (event.results_count || 0) === 0
  ).length;
  const topSignals = buildDemandInsights(demandEvents).slice(0, 12);

  return {
    range,
    periodLabel: period.label,
    generatedAt: new Date().toISOString(),
    impact: {
      confirmedReuses: agreements.length,
      soldItems,
      donatedItems,
      circularValue,
      reusedBooks,
      estimatedAvoidedCo2: reusedBooks * SCHOOL_BOOK_CO2E_KG,
      unquantifiedItems: Math.max(0, agreements.length - reusedBooks),
      activeSchools: activeSchoolsResult.count || 0,
      totalMembers: profilesResult.count || 0,
      activeListings: activeListingsResult.count || 0,
      listingViews: viewsResult.count || 0,
    },
    demand: {
      searches: demandEvents.length,
      zeroResultSearches,
      communitySearches: demandEvents.filter((event) => event.only_my_community).length,
      nearbySearches: demandEvents.filter((event) => event.nearby_mode).length,
      savedSearches: savedSearchesResult.count || 0,
      topSignals,
    },
  };
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function renderSuperAdminCsv(report: SuperAdminReport) {
  const rows: Array<Array<string | number>> = [
    ["Sección", "Métrica", "Valor"],
    ["Periodo", "Rango", report.periodLabel],
    ["Impacto", "Artículos reutilizados confirmados", report.impact.confirmedReuses],
    ["Impacto", "Ventas confirmadas", report.impact.soldItems],
    ["Impacto", "Donaciones confirmadas", report.impact.donatedItems],
    ["Impacto", "Valor circular acordado (EUR)", report.impact.circularValue.toFixed(2)],
    ["Impacto", "Libros incluidos en estimación CO2e", report.impact.reusedBooks],
    ["Impacto", "CO2e potencialmente evitado (kg)", report.impact.estimatedAvoidedCo2.toFixed(1)],
    ["Impacto", "Artículos sin factor CO2e", report.impact.unquantifiedItems],
    ["Comunidad", "Centros activos", report.impact.activeSchools],
    ["Comunidad", "Miembros", report.impact.totalMembers],
    ["Marketplace", "Anuncios activos", report.impact.activeListings],
    ["Marketplace", "Visitas a anuncios", report.impact.listingViews],
    ["Demanda", "Búsquedas", report.demand.searches],
    ["Demanda", "Búsquedas sin resultados", report.demand.zeroResultSearches],
    ["Demanda", "Búsquedas solo comunidad", report.demand.communitySearches],
    ["Demanda", "Búsquedas por proximidad", report.demand.nearbySearches],
    ["Demanda", "Búsquedas guardadas", report.demand.savedSearches],
  ];

  report.demand.topSignals.forEach((signal, index) => {
    rows.push([
      "Demanda",
      `Señal #${index + 1}: ${signal.kind} · ${signal.label}`,
      `${signal.searches} búsquedas / ${signal.zeroResults} sin resultado`,
    ]);
  });

  return "\ufeff" + rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function winAnsiByte(char: string) {
  const code = char.charCodeAt(0);
  if (code <= 255) return code;
  if (char === "€") return 0x80;
  return "?".charCodeAt(0);
}

function pdfHexText(value: string) {
  return Array.from(
    value
      .replace(/CO₂/g, "CO2")
      .replace(/[–—]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/•/g, "-")
  )
    .map((char) => winAnsiByte(char).toString(16).padStart(2, "0"))
    .join("");
}

function wrapText(value: string, max = 86) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > max) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function renderSuperAdminPdf(report: SuperAdminReport) {
  const lines: Array<{ text: string; bold?: boolean; size?: number; gap?: number }> = [
    { text: "Wetudy - Informe global", bold: true, size: 18, gap: 24 },
    { text: report.periodLabel, bold: true, size: 13, gap: 22 },
    { text: "Sostenibilidad e impacto", bold: true, size: 12, gap: 18 },
    { text: `Artículos reutilizados confirmados: ${report.impact.confirmedReuses}` },
    { text: `Ventas confirmadas: ${report.impact.soldItems}` },
    { text: `Donaciones confirmadas: ${report.impact.donatedItems}` },
    { text: `Valor circular acordado: ${report.impact.circularValue.toFixed(2)} EUR` },
    { text: `Libros escolares incluidos en estimación: ${report.impact.reusedBooks}` },
    { text: `CO2e potencialmente evitado estimado: ${report.impact.estimatedAvoidedCo2.toFixed(1)} kg` },
    { text: `Artículos reutilizados sin factor CO2e específico: ${report.impact.unquantifiedItems}`, gap: 20 },
    { text: "Comunidad y alcance", bold: true, size: 12, gap: 18 },
    { text: `Centros activos: ${report.impact.activeSchools}` },
    { text: `Miembros vinculados: ${report.impact.totalMembers}` },
    { text: `Anuncios activos: ${report.impact.activeListings}` },
    { text: `Visitas a anuncios: ${report.impact.listingViews}`, gap: 20 },
    { text: "Insights de demanda", bold: true, size: 12, gap: 18 },
    { text: `Búsquedas registradas: ${report.demand.searches}` },
    { text: `Búsquedas sin resultados: ${report.demand.zeroResultSearches}` },
    { text: `Búsquedas solo en la comunidad: ${report.demand.communitySearches}` },
    { text: `Búsquedas por proximidad: ${report.demand.nearbySearches}` },
    { text: `Búsquedas guardadas: ${report.demand.savedSearches}`, gap: 18 },
    { text: "Principales señales", bold: true, size: 11, gap: 16 },
    ...report.demand.topSignals.slice(0, 10).map((signal) => ({
      text: `${signal.label} · ${signal.searches} búsquedas · ${signal.zeroResults} sin resultado`,
      size: 9.5,
      gap: 14,
    })),
    { text: "Metodología ambiental", bold: true, size: 11, gap: 16 },
    {
      text: `La estimación de CO2e solo se aplica a libros escolares identificables, usando el mismo factor vigente del informe de centros: ${SCHOOL_BOOK_CO2E_KG.toFixed(1)} kg CO2e por libro. Otros materiales quedan sin cuantificar hasta disponer de metodología específica.`,
      size: 9,
    },
    {
      text: "Las métricas son agregadas y no incluyen contenido de conversaciones ni actividad individual detallada.",
      size: 9,
    },
  ];

  const pageStreams: string[] = [];
  let commands = [
    "0.145 0.388 0.918 rg 0 792 595 50 re f",
    "0.494 0.729 0.157 rg 0 788 595 4 re f",
    "1 1 1 rg BT /F2 20 Tf 40 808 Td <" + pdfHexText("Wetudy") + "> Tj ET",
    "0 0 0 rg",
  ];
  let y = 758;

  const pushPage = () => {
    pageStreams.push(commands.join("\n"));
    commands = [
      "0.145 0.388 0.918 rg 0 792 595 50 re f",
      "0.494 0.729 0.157 rg 0 788 595 4 re f",
      "1 1 1 rg BT /F2 20 Tf 40 808 Td <" + pdfHexText("Wetudy") + "> Tj ET",
      "0 0 0 rg",
    ];
    y = 758;
  };

  for (const item of lines) {
    for (const line of wrapText(item.text)) {
      if (y < 62) pushPage();
      commands.push(
        `BT /${item.bold ? "F2" : "F1"} ${item.size || 10.5} Tf 44 ${y} Td <${pdfHexText(line)}> Tj ET`
      );
      y -= item.gap || 15;
    }
  }
  pushPage();

  const objects: string[] = [];
  const pageIds: number[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  pageStreams.forEach((stream, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[2] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = new TextEncoder().encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
