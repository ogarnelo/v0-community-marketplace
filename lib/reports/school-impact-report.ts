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

export type MonthlyImpactPoint = {
  monthKey: string;
  monthLabel: string;
  reusedItems: number;
  soldItems: number;
  donatedItems: number;
  estimatedAvoidedCo2: number;
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
  monthlyImpact: MonthlyImpactPoint[];
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
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
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

export async function loadSchoolImpactReport(params: {
  schoolId: string;
  start: Date | null;
  end: Date;
  periodLabel: string;
  periodKey: string;
}): Promise<SchoolImpactReport> {
  const admin = createAdminClient();
  const { schoolId, start, end } = params;

  const [
    schoolResult,
    listingsResult,
    membersResult,
    adminsResult,
    agreementsResult,
    reportsResult,
  ] = await Promise.all([
    admin
      .from("schools")
      .select("id, name, city, region, is_active")
      .eq("id", schoolId)
      .maybeSingle<SchoolRow>(),
    admin
      .from("listings")
      .select("id, title, category, isbn, status, created_at")
      .eq("school_id", schoolId)
      .returns<ListingRow[]>(),
    admin
      .from("profiles")
      .select("id")
      .eq("school_id", schoolId),
    admin
      .from("user_roles")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("role", "school_admin"),
    (() => {
      let query = admin
        .from("agreements")
        .select("id, listing_id, agreement_type, status, amount, confirmed_at, created_at")
        .eq("school_id", schoolId)
        .eq("status", "confirmed")
        .lt("confirmed_at", end.toISOString());

      if (start) query = query.gte("confirmed_at", start.toISOString());
      return query.returns<AgreementRow[]>();
    })(),
    admin
      .from("reports")
      .select("id, listing_id, status")
      .eq("target_type", "listing")
      .in("status", ["open", "reviewing"]),
  ]);

  if (schoolResult.error) throw schoolResult.error;
  if (!schoolResult.data) throw new Error("Centro no encontrado.");
  if (listingsResult.error) throw listingsResult.error;
  if (membersResult.error) throw membersResult.error;
  if (adminsResult.error) throw adminsResult.error;
  if (agreementsResult.error) throw agreementsResult.error;
  if (reportsResult.error) throw reportsResult.error;

  const listings = (listingsResult.data || []) as ListingRow[];
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const agreements = (agreementsResult.data || []) as AgreementRow[];

  const reusedItems = agreements.length;
  const donatedItems = agreements.filter(
    (agreement) => agreement.agreement_type === "donation"
  ).length;
  const soldItems = reusedItems - donatedItems;
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

  const monthlyImpactMap = new Map<string, MonthlyImpactPoint>();

  for (const agreement of agreements) {
    const rawDate = agreement.confirmed_at || agreement.created_at;
    if (!rawDate) continue;

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) continue;

    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthLabel = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      month: "short",
      year: "2-digit",
    })
      .format(date)
      .replace(".", "");

    const current =
      monthlyImpactMap.get(monthKey) ||
      ({
        monthKey,
        monthLabel,
        reusedItems: 0,
        soldItems: 0,
        donatedItems: 0,
        estimatedAvoidedCo2: 0,
      } satisfies MonthlyImpactPoint);

    current.reusedItems += 1;
    if (agreement.agreement_type === "donation") {
      current.donatedItems += 1;
    } else {
      current.soldItems += 1;
    }

    if (
      agreement.listing_id &&
      isSchoolBook(listingById.get(agreement.listing_id))
    ) {
      current.estimatedAvoidedCo2 += SCHOOL_BOOK_CO2E_KG;
    }

    monthlyImpactMap.set(monthKey, current);
  }

  const monthlyImpact = Array.from(monthlyImpactMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-12);

  const listingIds = listings.map((listing) => listing.id);
  let listingViews = 0;

  if (listingIds.length > 0) {
    let viewQuery = admin
      .from("listing_views")
      .select("id", { count: "exact", head: true })
      .in("listing_id", listingIds)
      .lt("viewed_at", end.toISOString());

    if (start) viewQuery = viewQuery.gte("viewed_at", start.toISOString());
    const viewResult = await viewQuery;
    if (viewResult.error) throw viewResult.error;
    listingViews = viewResult.count || 0;
  }

  const openReportListingIds = new Set(
    (reportsResult.data || [])
      .map((report: any) => report.listing_id)
      .filter((value: string | null): value is string => Boolean(value))
  );

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
    members: membersResult.data?.length || 0,
    administrators: adminsResult.data?.length || 0,
    activeListings: listings.filter((listing) =>
      ["available", "reserved"].includes(listing.status || "")
    ).length,
    listingViews,
    openReports: listings.filter((listing) => openReportListingIds.has(listing.id)).length,
    monthlyImpact,
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

function pdfText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  size = 10,
  bold = false
) {
  commands.push(
    `0 0 0 rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td <${pdfHexText(text)}> Tj ET`
  );
}

function pdfRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: "blue" | "green" | "muted"
) {
  const fill =
    color === "blue"
      ? "0.145 0.388 0.918"
      : color === "green"
        ? "0.494 0.729 0.157"
        : "0.925 0.941 0.961";
  commands.push(`${fill} rg ${x} ${y} ${Math.max(0, width)} ${height} re f`);
}

function buildVisualImpactPage(report: SchoolImpactReport) {
  if (report.reusedItems <= 0) return null;

  const commands = [
    "0.145 0.388 0.918 rg 0 792 595 50 re f",
    "0.494 0.729 0.157 rg 0 788 595 4 re f",
    "1 1 1 rg BT /F2 20 Tf 40 808 Td <" + pdfHexText("Wetudy") + "> Tj ET",
  ];

  pdfText(commands, "Resumen visual de impacto", 44, 750, 17, true);
  pdfText(commands, report.periodLabel, 44, 730, 10);

  pdfText(commands, "Composición de la reutilización", 44, 690, 12, true);
  const maxComposition = Math.max(report.soldItems, report.donatedItems, 1);
  const barX = 155;
  const barWidth = 360;

  pdfText(commands, "Ventas", 44, 650, 10, true);
  pdfRect(commands, barX, 643, barWidth, 16, "muted");
  pdfRect(
    commands,
    barX,
    643,
    (report.soldItems / maxComposition) * barWidth,
    16,
    "blue"
  );
  pdfText(commands, String(report.soldItems), 525, 650, 10, true);

  pdfText(commands, "Donaciones", 44, 610, 10, true);
  pdfRect(commands, barX, 603, barWidth, 16, "muted");
  pdfRect(
    commands,
    barX,
    603,
    (report.donatedItems / maxComposition) * barWidth,
    16,
    "green"
  );
  pdfText(commands, String(report.donatedItems), 525, 610, 10, true);

  if (report.reusedBooks > 0 || report.unquantifiedItems > 0) {
    pdfText(commands, "Cobertura de la estimación CO2e", 44, 550, 12, true);
    const quantified = report.reusedBooks;
    const unquantified = report.unquantifiedItems;
    const total = Math.max(quantified + unquantified, 1);
    const coverageX = 44;
    const coverageWidth = 480;
    const quantifiedWidth = (quantified / total) * coverageWidth;

    pdfRect(commands, coverageX, 515, coverageWidth, 18, "muted");
    pdfRect(commands, coverageX, 515, quantifiedWidth, 18, "green");
    pdfText(
      commands,
      `Con factor específico: ${quantified} · Sin factor: ${unquantified}`,
      44,
      492,
      9.5
    );
  }

  const monthly = report.monthlyImpact.filter((point) => point.reusedItems > 0);

  if (monthly.length >= 2) {
    pdfText(commands, "Evolución mensual de reutilización", 44, 445, 12, true);
    pdfText(commands, "Azul: ventas · Verde: donaciones", 44, 428, 8.5);

    const chartX = 55;
    const chartY = 180;
    const chartWidth = 480;
    const chartHeight = 205;
    const maxMonthly = Math.max(...monthly.map((point) => point.reusedItems), 1);
    const slotWidth = chartWidth / monthly.length;
    const columnWidth = Math.min(28, Math.max(12, slotWidth * 0.56));

    commands.push(`0.82 0.84 0.87 RG 0.7 w ${chartX} ${chartY} m ${chartX + chartWidth} ${chartY} l S`);

    monthly.forEach((point, index) => {
      const x = chartX + index * slotWidth + (slotWidth - columnWidth) / 2;
      const totalHeight = (point.reusedItems / maxMonthly) * chartHeight;
      const soldHeight =
        point.reusedItems > 0
          ? totalHeight * (point.soldItems / point.reusedItems)
          : 0;
      const donationHeight = Math.max(0, totalHeight - soldHeight);

      if (soldHeight > 0) {
        pdfRect(commands, x, chartY, columnWidth, soldHeight, "blue");
      }
      if (donationHeight > 0) {
        pdfRect(
          commands,
          x,
          chartY + soldHeight,
          columnWidth,
          donationHeight,
          "green"
        );
      }

      pdfText(
        commands,
        String(point.reusedItems),
        x + Math.max(0, columnWidth / 2 - 3),
        chartY + totalHeight + 7,
        7.5,
        true
      );
      pdfText(
        commands,
        point.monthLabel,
        x - 4,
        chartY - 18,
        monthly.length > 8 ? 6.5 : 7.5
      );
    });
  } else {
    pdfText(
      commands,
      "La evolución mensual aparecerá cuando existan datos en al menos dos meses.",
      44,
      430,
      9.5
    );
  }

  pdfText(
    commands,
    "Los gráficos representan datos registrados en Wetudy; la estimación CO2e mantiene los supuestos descritos en la metodología.",
    44,
    105,
    8.5
  );

  return commands.join("\n");
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

  const visualPage = buildVisualImpactPage(report);
  if (visualPage) {
    pageStreams.push(visualPage);
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
