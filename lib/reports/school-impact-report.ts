import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const SCHOOL_BOOK_CO2E_KG = 2.1;
export const CARBON_FOOTPRINT_SOURCE =
  "https://www.carbonfootprintitaly.it/en/registro/prodotti/p-2023-0003/";
export const GHG_PROTOCOL_SOURCE =
  "https://ghgprotocol.org/estimating-and-reporting-avoided-emissions";

type ListingRow = {
  id: string;
  title: string | null;
  category: string | null;
  isbn: string | null;
  status: string | null;
  created_at: string;
};

type AgreementRow = {
  id: string;
  listing_id: string | null;
  agreement_type: string | null;
  status: string | null;
  amount: number | null;
  confirmed_at: string | null;
  created_at: string | null;
};

type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  is_active: boolean | null;
};

export type SchoolImpactReport = {
  school: SchoolRow;
  periodLabel: string;
  periodKey: string;
  reusedItems: number;
  donatedItems: number;
  soldItems: number;
  circularValue: number;
  reusedBooks: number;
  estimatedAvoidedCo2: number;
  unquantifiedItems: number;
  members: number;
  administrators: number;
  activeListings: number;
  listingViews: number;
  openReports: number;
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSchoolBook(listing: ListingRow | undefined) {
  if (!listing) return false;
  if (listing.isbn?.trim()) return true;

  const text = normalize(`${listing.category || ""} ${listing.title || ""}`);
  return ["libro", "libros", "texto", "lectura", "textbook", "book", "manual"].some(
    (token) => text.includes(token)
  );
}

export function previousCalendarMonth(now = new Date()) {
  // The cron's due date is interpreted in Europe/Madrid. Derive the month
  // from that SAME civil calendar; at 00:30 Madrid on the first day, UTC may
  // still be on the previous month's last day (in winter AND summer).
  // Keep existing UTC metric boundaries here: changing the report aggregation
  // window itself needs a separately reviewed data/methodology migration.
  const madridParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit",
  }).formatToParts(now);
  const year = Number(madridParts.find(p => p.type === "year")?.value);
  const month = Number(madridParts.find(p => p.type === "month")?.value) - 1;
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const label = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    month: "long",
    year: "numeric",
  }).format(start);

  return {
    start,
    end,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

export function dashboardRange(range: "90d" | "365d" | "total", now = new Date()) {
  if (range === "total") {
    return {
      start: null,
      end: now,
      label: "Histórico",
      key: "historico",
    };
  }

  const days = range === "90d" ? 90 : 365;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);

  return {
    start,
    end: now,
    label: range === "90d" ? "Últimos 90 días" : "Últimos 12 meses",
    key: range,
  };
}

/**
 * PostgREST limits returned rows by default. A report must never publish
 * partial school totals as if they were complete. Read deterministic pages,
 * reject duplicate IDs, and fail closed on excessive volume or query errors.
 */
async function readAllSchoolImpactRows<T extends { id: string }>(
  loadPage: (afterId: string | null, limit: number) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
): Promise<T[]> {
  const pageSize = 250;
  const maxRows = 10000;
  const result: T[] = [];
  let afterId: string | null = null;
  // Seek by stable PK, never offset: a deletion before an offset page must not
  // cause the next school listing or agreement to be skipped.
  for (let page = 0; page <= maxRows / pageSize; page += 1) {
    const { data, error } = await loadPage(afterId, pageSize);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("SCHOOL_REPORT_PAGE_UNAVAILABLE");
    if (data.length > pageSize)
      throw new Error("SCHOOL_REPORT_PAGINATION_INCONSISTENT");
    if (result.length + data.length > maxRows)
      throw new Error("SCHOOL_REPORT_ROW_LIMIT_EXCEEDED");
    for (const row of data) {
      if (typeof row?.id !== "string" || !row.id ||
          (afterId !== null && row.id <= afterId))
        throw new Error("SCHOOL_REPORT_PAGINATION_INCONSISTENT");
      afterId = row.id;
      result.push(row);
    }
    if (data.length < pageSize) return result;
  }
  throw new Error("SCHOOL_REPORT_ROW_LIMIT_EXCEEDED");
}

export async function loadSchoolImpactReport(params: {
  schoolId: string;
  start: Date | null;
  end: Date;
  periodLabel: string;
  periodKey: string;
}): Promise<SchoolImpactReport> {
  // All consumers (school-admin PDF, scheduled reports and future federative
  // readers) share this privileged loader. Reject malformed scope and dates
  // BEFORE creating a service client or issuing any query.
  const { schoolId, start, end } = params;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof schoolId !== "string" || !uuid.test(schoolId) ||
      !(end instanceof Date) || !Number.isFinite(end.getTime()) ||
      (start !== null && (!(start instanceof Date) ||
        !Number.isFinite(start.getTime()) || start.getTime() >= end.getTime())) ||
      typeof params.periodLabel !== "string" || !params.periodLabel.trim() ||
      params.periodLabel.length > 128 ||
      typeof params.periodKey !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(params.periodKey))
    throw new Error("SCHOOL_REPORT_INVALID_SCOPE_OR_PERIOD");

  const admin = createAdminClient();

  // Fail closed BEFORE privileged reads for inactive/deleted schools.
  const schoolResult = await admin
    .from("schools")
    .select("id, name, city, region, is_active")
    .eq("id", schoolId)
    .maybeSingle<SchoolRow>();
  if (schoolResult.error) throw schoolResult.error;
  if (!schoolResult.data) throw new Error("Centro no encontrado.");
  if (schoolResult.data.is_active !== true)
    throw new Error("SCHOOL_REPORT_INACTIVE");

  // Best-effort concurrency fence: compare authoritative row counts before
  // and after paginating. This detects insert/delete drift, but CANNOT replace
  // a transaction-wide REPEATABLE READ snapshot (updates preserving counts
  // are still possible). Fail instead of publishing a known-partial report.
  async function readSourceCounts() {
    const listingCountQuery = admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_demo", false);
    let agreementCountQuery = admin
      .from("agreements")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "confirmed")
      .lt("confirmed_at", end.toISOString());
    if (start) agreementCountQuery = agreementCountQuery.gte("confirmed_at", start.toISOString());
    const [l, a] = await Promise.all([listingCountQuery, agreementCountQuery]);
    if (l.error) throw l.error;
    if (a.error) throw a.error;
    if (!Number.isSafeInteger(l.count) || l.count < 0 ||
        !Number.isSafeInteger(a.count) || a.count < 0)
      throw new Error("SCHOOL_REPORT_SOURCE_COUNT_UNAVAILABLE");
    return { listings: l.count, agreements: a.count };
  }

  const initialCounts = await readSourceCounts();

  const [
    listingsResult,
    membersResult,
    adminsResult,
    agreementsResult,
  ] = await Promise.all([
    readAllSchoolImpactRows<ListingRow>((afterId, limit) => {
      let query = admin
        .from("listings")
        .select("id, title, category, isbn, status, created_at")
        .eq("school_id", schoolId)
        .eq("is_demo", false);
      if (afterId) query = query.gt("id", afterId);
      return query
        .order("id", { ascending: true })
        .limit(limit)
        .returns<ListingRow[]>();
    }),
    // Exact database counts avoid downloading user IDs and the implicit
    // PostgREST row limit (typically 1,000) under-counting larger schools.
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    admin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("role", "school_admin"),
    readAllSchoolImpactRows<AgreementRow>((afterId, limit) => {
      let query = admin
        .from("agreements")
        .select("id, listing_id, agreement_type, status, amount, confirmed_at, created_at")
        .eq("school_id", schoolId)
        .eq("status", "confirmed")
        .lt("confirmed_at", end.toISOString());
      if (start) query = query.gte("confirmed_at", start.toISOString());
      if (afterId) query = query.gt("id", afterId);
      return query
        .order("id", { ascending: true })
        .limit(limit)
        .returns<AgreementRow[]>();
    }),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (adminsResult.error) throw adminsResult.error;
  if (membersResult.count === null || !Number.isSafeInteger(membersResult.count) ||
      membersResult.count < 0)
    throw new Error("SCHOOL_REPORT_MEMBERS_COUNT_UNAVAILABLE");
  if (adminsResult.count === null || !Number.isSafeInteger(adminsResult.count) ||
      adminsResult.count < 0)
    throw new Error("SCHOOL_REPORT_ADMINS_COUNT_UNAVAILABLE");


  const listings = listingsResult;
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const agreements = agreementsResult
    .filter((agreement) => Boolean(agreement.listing_id && listingById.has(agreement.listing_id)));

  // Confirmed reuse is per listing, not per matching payment/offer record.
  // The database does not currently enforce a unique confirmed agreement per
  // listing, so reject an ambiguous duplicate instead of double counting.
  const confirmedListings = new Set<string>();
  for (const agreement of agreements) {
    if (agreement.agreement_type !== "sale" && agreement.agreement_type !== "donation")
      throw new Error("SCHOOL_REPORT_AGREEMENT_TYPE_INVALID");
    if (confirmedListings.has(agreement.listing_id!))
      throw new Error("SCHOOL_REPORT_DUPLICATE_CONFIRMED_LISTING");
    confirmedListings.add(agreement.listing_id!);
    if (agreement.amount !== null &&
        (!Number.isFinite(agreement.amount) || agreement.amount < 0))
      throw new Error("SCHOOL_REPORT_AGREEMENT_AMOUNT_INVALID");
  }

  const reusedItems = agreements.length;
  const donatedItems = agreements.filter(
    (agreement) => agreement.agreement_type === "donation"
  ).length;
  const soldItems = reusedItems - donatedItems;
  // Monetary KPI must be accumulated as integer euro cents. Floating point
  // arithmetic (0.1 + 0.2) otherwise leaks artificial decimals into reports,
  // and numeric/PostgREST coercion must not silently turn missing sales into 0.
  let circularCents = 0;
  for (const agreement of agreements) {
    if (agreement.agreement_type === "donation") continue;
    const amount = agreement.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
      throw new Error("SCHOOL_REPORT_AGREEMENT_AMOUNT_INVALID");
    const rawCents = amount * 100;
    const cents = Math.round(rawCents);
    if (!Number.isSafeInteger(cents))
      throw new Error("SCHOOL_REPORT_CIRCULAR_VALUE_UNSAFE");
    if (Math.abs(rawCents - cents) > 1e-6)
      throw new Error("SCHOOL_REPORT_AGREEMENT_AMOUNT_INVALID");
    circularCents += cents;
    if (!Number.isSafeInteger(circularCents))
      throw new Error("SCHOOL_REPORT_CIRCULAR_VALUE_UNSAFE");
  }
  const circularValue = circularCents / 100;
  const reusedBooks = agreements.filter((agreement) =>
    agreement.listing_id ? isSchoolBook(listingById.get(agreement.listing_id)) : false
  ).length;

  const listingIds = listings.map((listing) => listing.id);
  let listingViews = 0;
  const openReportListingIds = new Set<string>();

  // Restrict privileged incident reads to THIS school's known listings in SQL,
  // never retrieve reports about unrelated schools and filter them in memory.
  // Chunk IN predicates to avoid unbounded PostgREST URL/query size.
  const chunkSize = 75;
  for (let offset = 0; offset < listingIds.length; offset += chunkSize) {
    const ids = listingIds.slice(offset, offset + chunkSize);
    let viewQuery = admin
      .from("listing_views")
      .select("id", { count: "exact", head: true })
      .in("listing_id", ids)
      .lt("viewed_at", end.toISOString());

    if (start) viewQuery = viewQuery.gte("viewed_at", start.toISOString());
    const viewResult = await viewQuery;
    if (viewResult.error) throw viewResult.error;
    if (viewResult.count === null || !Number.isSafeInteger(viewResult.count))
      throw new Error("SCHOOL_REPORT_VIEW_COUNT_UNAVAILABLE");
    listingViews += viewResult.count;
    if (!Number.isSafeInteger(listingViews))
      throw new Error("SCHOOL_REPORT_VIEW_COUNT_UNSAFE");

    const incidentRows = await readAllSchoolImpactRows<{
      id: string; listing_id: string | null;
    }>((afterId, limit) => {
      let query = admin
        .from("reports")
        .select("id, listing_id")
        .eq("target_type", "listing")
        .in("status", ["open", "reviewing"])
        .in("listing_id", ids);
      if (afterId) query = query.gt("id", afterId);
      return query
        .order("id", { ascending: true })
        .limit(limit)
        .returns<Array<{ id: string; listing_id: string | null }>>();
    });
    for (const row of incidentRows || []) {
      if (row.listing_id && ids.includes(row.listing_id))
        openReportListingIds.add(row.listing_id);
    }
  }

  const finalCounts = await readSourceCounts();
  if (initialCounts.listings !== finalCounts.listings ||
      initialCounts.agreements !== finalCounts.agreements ||
      listings.length !== finalCounts.listings ||
      agreementsResult.length !== finalCounts.agreements)
    throw new Error("SCHOOL_REPORT_CONCURRENT_SOURCE_CHANGE");

  // The school may have been deactivated while several paginated privileged
  // reads were running. Never publish a report after that revocation.
  const freshSchool = await admin
    .from("schools")
    .select("id, is_active")
    .eq("id", schoolId)
    .maybeSingle<Pick<SchoolRow, "id" | "is_active">>();
  if (freshSchool.error) throw freshSchool.error;
  if (!freshSchool.data || freshSchool.data.id !== schoolId ||
      freshSchool.data.is_active !== true)
    throw new Error("SCHOOL_REPORT_INACTIVE");

  return {
    school: schoolResult.data,
    periodLabel: params.periodLabel,
    periodKey: params.periodKey,
    reusedItems,
    donatedItems,
    soldItems,
    circularValue,
    reusedBooks,
    estimatedAvoidedCo2: reusedBooks * SCHOOL_BOOK_CO2E_KG,
    unquantifiedItems: Math.max(0, reusedItems - reusedBooks),
    members: membersResult.count,
    administrators: adminsResult.count,
    activeListings: listings.filter((listing) =>
      ["available", "reserved"].includes(listing.status || "")
    ).length,
    listingViews,
    openReports: listings.filter((listing) => openReportListingIds.has(listing.id)).length,
  };
}

function winAnsiByte(char: string) {
  const code = char.charCodeAt(0);
  if (code <= 255) return code;
  if (char === "€") return 0x80;
  return "?".charCodeAt(0);
}

function pdfHexText(value: string) {
  const normalized = value
    .replace(/CO₂/g, "CO2")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-");

  return Array.from(normalized)
    .map((char) => winAnsiByte(char).toString(16).padStart(2, "0"))
    .join("");
}

function wrapText(value: string, max = 88) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function renderSchoolImpactPdf(report: SchoolImpactReport) {
  const lines: Array<{ text: string; bold?: boolean; size?: number; gap?: number }> = [
    { text: report.school.name, bold: true, size: 18, gap: 24 },
    { text: `Informe de impacto - ${report.periodLabel}`, bold: true, size: 13, gap: 22 },
    { text: "Impacto medido", bold: true, size: 12, gap: 18 },
    { text: `Artículos reutilizados confirmados: ${report.reusedItems}` },
    { text: `Ventas confirmadas: ${report.soldItems}` },
    { text: `Donaciones confirmadas: ${report.donatedItems}` },
    { text: `Valor circular acordado: ${report.circularValue.toFixed(2)} EUR` },
    { text: `Miembros vinculados: ${report.members}` },
    { text: `Administradores del centro: ${report.administrators}` },
    { text: `Anuncios activos: ${report.activeListings}` },
    { text: `Visitas a anuncios en el periodo: ${report.listingViews}` },
    { text: `Incidencias abiertas o en revisión: ${report.openReports}`, gap: 22 },
    { text: "Estimación ambiental", bold: true, size: 12, gap: 18 },
    { text: `Libros escolares incluidos en estimación: ${report.reusedBooks}` },
    { text: `CO2e potencialmente evitado estimado: ${report.estimatedAvoidedCo2.toFixed(1)} kg` },
    { text: `Artículos reutilizados sin factor CO2e específico: ${report.unquantifiedItems}`, gap: 18 },
    {
      text:
        "Metodología: las emisiones evitadas se presentan separadamente. La estimación presupone que la reutilización sustituye la compra de un producto nuevo equivalente.",
    },
    {
      text:
        "Factor inicial para libro escolar: 2,1 kg CO2e por libro escolar de 1 kg. Otros materiales no reciben todavía un factor específico.",
    },
    { text: `Fuente factor: ${CARBON_FOOTPRINT_SOURCE}` },
    { text: `Referencia metodológica: ${GHG_PROTOCOL_SOURCE}`, gap: 18 },
    {
      text:
        "Este documento es una estimación informativa de impacto de uso de Wetudy y no constituye una verificación independiente de huella de carbono.",
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
    const wrapped = wrapText(item.text);
    for (const line of wrapped) {
      if (y < 62) pushPage();
      const font = item.bold ? "F2" : "F1";
      const size = item.size || 10.5;
      commands.push(
        `BT /${font} ${size} Tf 44 ${y} Td <${pdfHexText(line)}> Tj ET`
      );
      y -= item.gap || 15;
    }
  }
  pushPage();

  const hasChartData =
    report.reusedItems > 0 ||
    report.soldItems > 0 ||
    report.donatedItems > 0 ||
    report.activeListings > 0 ||
    report.listingViews > 0 ||
    report.estimatedAvoidedCo2 > 0;

  if (hasChartData) {
    const drawHorizontalBars = (
      title: string,
      rows: Array<{ label: string; value: number; display: string }>,
      color: "blue" | "green"
    ) => {
      if (y < 220) pushPage();

      commands.push(
        `BT /F2 13 Tf 44 ${y} Td <${pdfHexText(title)}> Tj ET`
      );
      y -= 24;

      const maxValue = Math.max(...rows.map((row) => row.value), 1);
      const maxWidth = 410;

      for (const row of rows) {
        commands.push(
          `BT /F1 9.5 Tf 44 ${y} Td <${pdfHexText(`${row.label}: ${row.display}`)}> Tj ET`
        );
        y -= 15;

        commands.push(`0.92 0.94 0.97 rg 44 ${y} ${maxWidth} 11 re f`);

        const barWidth = Math.max(
          row.value > 0 ? 4 : 0,
          Math.min(maxWidth, (row.value / maxValue) * maxWidth)
        );

        if (barWidth > 0) {
          commands.push(
            color === "green"
              ? `0.494 0.729 0.157 rg 44 ${y} ${barWidth.toFixed(2)} 11 re f`
              : `0.145 0.388 0.918 rg 44 ${y} ${barWidth.toFixed(2)} 11 re f`
          );
        }

        y -= 27;
      }

      commands.push("0 0 0 rg");
      y -= 12;
    };

    commands.push(
      `BT /F2 18 Tf 44 ${y} Td <${pdfHexText("Gráficos de impacto")}> Tj ET`
    );
    y -= 28;
    commands.push(
      `BT /F1 10 Tf 44 ${y} Td <${pdfHexText(
        "Los gráficos se generan únicamente cuando existen datos reales en el periodo."
      )}> Tj ET`
    );
    y -= 32;

    if (report.soldItems > 0 || report.donatedItems > 0) {
      drawHorizontalBars(
        "Acuerdos confirmados",
        [
          { label: "Ventas", value: report.soldItems, display: String(report.soldItems) },
          {
            label: "Donaciones",
            value: report.donatedItems,
            display: String(report.donatedItems),
          },
        ],
        "blue"
      );
    }

    if (
      report.reusedItems > 0 ||
      report.activeListings > 0 ||
      report.listingViews > 0
    ) {
      drawHorizontalBars(
        "Actividad y alcance",
        [
          {
            label: "Artículos reutilizados",
            value: report.reusedItems,
            display: String(report.reusedItems),
          },
          {
            label: "Anuncios activos",
            value: report.activeListings,
            display: String(report.activeListings),
          },
          {
            label: "Visitas a anuncios",
            value: report.listingViews,
            display: String(report.listingViews),
          },
        ],
        "blue"
      );
    }

    if (report.estimatedAvoidedCo2 > 0) {
      if (y < 130) pushPage();
      commands.push(`0.94 0.98 0.91 rg 44 ${y - 54} 470 66 re f`);
      commands.push(
        `0 0 0 rg BT /F2 12 Tf 58 ${y - 20} Td <${pdfHexText(
          "Estimación ambiental"
        )}> Tj ET`
      );
      commands.push(
        `BT /F2 20 Tf 58 ${y - 45} Td <${pdfHexText(
          `${report.estimatedAvoidedCo2.toFixed(1)} kg CO2e potencialmente evitado`
        )}> Tj ET`
      );
      y -= 88;
    }

    pushPage();
  }

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

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

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
