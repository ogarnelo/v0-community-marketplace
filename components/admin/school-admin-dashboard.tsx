"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  Euro,
  Eye,
  FileText,
  Leaf,
  Package,
  Printer,
  QrCode,
  Recycle,
  Save,
  Send,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  school_type: string | null;
};

type ListingRow = {
  id: string;
  title: string | null;
  category: string | null;
  grade_level: string | null;
  price: number | null;
  original_price: number | null;
  estimated_retail_price: number | null;
  isbn: string | null;
  type: string | null;
  status: string | null;
  condition: string | null;
  seller_id: string | null;
  school_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  school_id: string | null;
  user_type: string | null;
  grade_level: string | null;
};

type ReportRow = {
  id: string;
  target_type: "listing" | "conversation";
  listing_id: string | null;
  conversation_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};

type SchoolAccessCodeRow = {
  code: string;
  is_active: boolean;
  created_at: string;
};

type ListingViewRow = {
  listing_id: string;
  viewed_at: string;
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

type ImpactSubscription = {
  enabled: boolean;
  email: string;
  day_of_month: number;
  last_sent_month: string | null;
};

type ImpactDelivery = {
  id: string;
  email: string;
  period_key: string;
  period_label: string;
  source: "manual" | "cron";
  sent_at: string;
};

type Props = {
  school: SchoolRow | null;
  listings: ListingRow[];
  members: ProfileRow[];
  schoolAdmins: ProfileRow[];
  reports: ReportRow[];
  accessCodes: SchoolAccessCodeRow[];
  listingViews: ListingViewRow[];
  agreements: AgreementRow[];
  reportSubscription: ImpactSubscription | null;
  currentUserEmail: string;
  reportDeliveries: ImpactDelivery[];
};

type RangeKey = "90d" | "365d" | "total";

const SCHOOL_BOOK_CO2E_KG = 2.1;
const CARBON_FOOTPRINT_SOURCE =
  "https://www.carbonfootprintitaly.it/en/registro/prodotti/p-2023-0003/";
const GHG_PROTOCOL_SOURCE =
  "https://ghgprotocol.org/estimating-and-reporting-avoided-emissions";

function isWithinRange(value: string | null, range: RangeKey) {
  if (!value || range === "total") return Boolean(value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  const start = new Date();
  start.setDate(start.getDate() - (range === "90d" ? 90 : 365));
  return parsed >= start;
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

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

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="flex gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SchoolAdminDashboard({
  school,
  listings,
  members,
  schoolAdmins,
  reports,
  accessCodes,
  listingViews,
  agreements,
  reportSubscription,
  currentUserEmail,
  reportDeliveries,
}: Props) {
  const [range, setRange] = useState<RangeKey>("365d");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [activeTab, setActiveTab] = useState("impact");
  const [qrShareStatus, setQrShareStatus] = useState("");
  const [monthlyEnabled, setMonthlyEnabled] = useState(reportSubscription?.enabled ?? false);
  const [monthlyEmail, setMonthlyEmail] = useState(reportSubscription?.email || currentUserEmail);
  const [monthlyDay, setMonthlyDay] = useState(reportSubscription?.day_of_month || 1);
  const [monthlySaving, setMonthlySaving] = useState(false);
  const [monthlySending, setMonthlySending] = useState(false);
  const [monthlyStatus, setMonthlyStatus] = useState("");
  const [lastSentMonth, setLastSentMonth] = useState(reportSubscription?.last_sent_month || null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && ["impact", "activity", "community", "access"].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, []);

  const listingById = useMemo(
    () => new Map(listings.map((listing) => [listing.id, listing])),
    [listings]
  );

  const confirmedAgreements = useMemo(
    () =>
      agreements.filter(
        (agreement) =>
          agreement.status === "confirmed" &&
          isWithinRange(agreement.confirmed_at || agreement.created_at, range)
      ),
    [agreements, range]
  );

  const filteredListings = useMemo(
    () => listings.filter((listing) => isWithinRange(listing.created_at, range)),
    [listings, range]
  );

  const filteredViews = useMemo(
    () => listingViews.filter((view) => isWithinRange(view.viewed_at, range)),
    [listingViews, range]
  );

  const reusedItems = confirmedAgreements.length;
  const donatedItems = confirmedAgreements.filter(
    (agreement) => agreement.agreement_type === "donation"
  ).length;
  const soldItems = confirmedAgreements.filter(
    (agreement) => agreement.agreement_type !== "donation"
  ).length;

  const circularValue = confirmedAgreements.reduce(
    (sum, agreement) =>
      agreement.agreement_type !== "donation" && typeof agreement.amount === "number"
        ? sum + agreement.amount
        : sum,
    0
  );

  const reusedBooks = confirmedAgreements.filter((agreement) =>
    agreement.listing_id
      ? isSchoolBook(listingById.get(agreement.listing_id))
      : false
  ).length;

  const estimatedAvoidedCo2 = reusedBooks * SCHOOL_BOOK_CO2E_KG;
  const unquantifiedItems = Math.max(0, reusedItems - reusedBooks);
  const activeListings = listings.filter((listing) =>
    ["available", "reserved"].includes(listing.status || "")
  ).length;
  const openReports = reports.filter((report) =>
    ["open", "reviewing"].includes(report.status || "")
  ).length;
  const reuseRate =
    filteredListings.length > 0
      ? Math.min(100, (reusedItems / filteredListings.length) * 100)
      : 0;
  const latestAccessCode = accessCodes.find((item) => item.is_active)?.code || null;

  const reportRows = [
    ["Centro", school?.name || "Centro"],
    ["Periodo", range === "90d" ? "Últimos 90 días" : range === "365d" ? "Últimos 12 meses" : "Histórico"],
    ["Artículos reutilizados confirmados", String(reusedItems)],
    ["Ventas confirmadas", String(soldItems)],
    ["Donaciones confirmadas", String(donatedItems)],
    ["Valor de ventas acordadas (€)", circularValue.toFixed(2)],
    ["Libros escolares incluidos en estimación CO2e", String(reusedBooks)],
    ["CO2e potencialmente evitado estimado (kg)", estimatedAvoidedCo2.toFixed(1)],
    ["Artículos reutilizados sin factor CO2e específico", String(unquantifiedItems)],
    ["Miembros vinculados al centro", String(members.length)],
    ["Administradores del centro", String(schoolAdmins.length)],
    ["Anuncios activos", String(activeListings)],
    ["Visitas a anuncios en periodo", String(filteredViews.length)],
    ["Incidencias abiertas/en revisión", String(openReports)],
    ["Factor orientativo libro escolar (kg CO2e/unidad)", String(SCHOOL_BOOK_CO2E_KG)],
    ["Metodología", "Emisiones evitadas reportadas separadamente; estimación condicionada a sustitución de compra nueva equivalente."],
    ["Fuente factor libro", CARBON_FOOTPRINT_SOURCE],
    ["Referencia metodológica", GHG_PROTOCOL_SOURCE],
  ];

  const downloadCsv = () => {
    const csv = reportRows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wetudy-impacto-${(school?.name || "centro")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyAccessCode = async () => {
    if (!latestAccessCode) return;
    await navigator.clipboard.writeText(latestAccessCode);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1600);
  };

  const getSchoolShareUrl = () => {
    if (!school?.id || typeof window === "undefined") return "";
    const url = new URL("/onboarding/join-school", window.location.origin);
    url.searchParams.set("school", school.id);
    return url.toString();
  };

  const copySchoolShareLink = async () => {
    const url = getSchoolShareUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    window.setTimeout(() => setCopiedShareLink(false), 1800);
  };

  const shareSchoolLink = async () => {
    const url = getSchoolShareUrl();
    if (!url) return;

    const shareText = `Únete a ${school?.name || "nuestro centro"} en Wetudy.`;

    if (typeof navigator.share === "function") {
      await navigator.share({
        title: `Wetudy · ${school?.name || "Centro"}`,
        text: shareText,
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(`${shareText} ${url}`);
    setCopiedShareLink(true);
    window.setTimeout(() => setCopiedShareLink(false), 1800);
  };

  const shareSchoolQr = async () => {
    setQrShareStatus("");

    try {
      const response = await fetch("/api/school/share-qr?format=png", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudo preparar el QR.");
      }

      const blob = await response.blob();
      const safeSchoolName = (school?.name || "centro")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const file = new File([blob], `wetudy-${safeSchoolName || "centro"}-qr.png`, {
        type: "image/png",
      });
      const url = getSchoolShareUrl();
      const text = `Únete a ${school?.name || "nuestro centro"} en Wetudy escaneando este QR o usando el enlace.`;

      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: `Wetudy · ${school?.name || "Centro"}`,
          text,
          files: [file],
        });
        setQrShareStatus("QR compartido.");
        return;
      }

      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `Wetudy · ${school?.name || "Centro"}`,
          text,
          url,
        });
        setQrShareStatus("Enlace del centro compartido.");
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      await navigator.clipboard.writeText(url);
      setQrShareStatus("QR descargado y enlace copiado.");
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("Error compartiendo QR:", error);
      setQrShareStatus(error?.message || "No se pudo compartir el QR.");
    }
  };

  const saveMonthlyReport = async () => {
    setMonthlySaving(true);
    setMonthlyStatus("");

    try {
      const response = await fetch("/api/school/report-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: monthlyEnabled,
          email: monthlyEmail,
          dayOfMonth: monthlyDay,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar la programación.");
      }

      setMonthlyStatus(payload?.message || "Programación guardada.");
    } catch (error: any) {
      setMonthlyStatus(error?.message || "No se pudo guardar la programación.");
    } finally {
      setMonthlySaving(false);
    }
  };

  const sendMonthlyReportNow = async () => {
    setMonthlySending(true);
    setMonthlyStatus("");

    try {
      const response = await fetch("/api/school/send-impact-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: monthlyEmail }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo enviar el informe.");
      }

      setLastSentMonth(payload?.periodKey || payload?.period || lastSentMonth);
      setMonthlyStatus(payload?.message || "Informe enviado.");
    } catch (error: any) {
      setMonthlyStatus(error?.message || "No se pudo enviar el informe.");
    } finally {
      setMonthlySending(false);
    }
  };

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-emerald-700" />
            <p className="font-semibold text-emerald-950">Informe de impacto del centro</p>
          </div>
          <p className="mt-1 text-sm text-emerald-900/80">
            Métricas para memoria de sostenibilidad, AMPA, dirección y comunidad educativa.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-emerald-200 bg-white p-1 text-xs">
          {([
            ["90d", "90 días"],
            ["365d", "12 meses"],
            ["total", "Histórico"],
          ] as const).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={range === key ? "default" : "ghost"}
              className="h-8 px-2"
              onClick={() => setRange(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:w-fit">
          <TabsTrigger value="impact" className="h-9">Impacto</TabsTrigger>
          <TabsTrigger value="activity" className="h-9">Actividad</TabsTrigger>
          <TabsTrigger value="community" className="h-9">Comunidad</TabsTrigger>
          <TabsTrigger value="access" className="h-auto min-h-9 px-2 text-xs sm:text-sm">Código de colegio</TabsTrigger>
        </TabsList>

        <TabsContent value="impact" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Recycle className="h-5 w-5" />}
              value={String(reusedItems)}
              label="Artículos reutilizados"
              detail="Acuerdos confirmados en Wetudy dentro del periodo."
            />
            <MetricCard
              icon={<Leaf className="h-5 w-5" />}
              value={`${estimatedAvoidedCo2.toFixed(1)} kg`}
              label="CO₂e potencialmente evitado"
              detail={`${reusedBooks} libro(s) con factor específico; ${unquantifiedItems} artículo(s) aún sin factor.`}
            />
            <MetricCard
              icon={<Euro className="h-5 w-5" />}
              value={formatMoney(circularValue)}
              label="Valor circular acordado"
              detail="Suma de importes en ventas confirmadas. Las donaciones no se monetizan aquí."
            />
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              value={String(members.length)}
              label="Comunidad vinculada"
              detail={`${schoolAdmins.length} administrador(es) de centro.`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resumen para reportes
                </CardTitle>
                <CardDescription>
                  Datos medidos por la plataforma y estimaciones ambientales separadas.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Reutilización</p>
                  <p className="mt-2 text-xl font-semibold">{reusedItems} operaciones</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {soldItems} ventas · {donatedItems} donaciones
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Tasa orientativa</p>
                  <p className="mt-2 text-xl font-semibold">{reuseRate.toFixed(1)}%</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Acuerdos confirmados frente a anuncios publicados en el periodo.
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Alcance</p>
                  <p className="mt-2 text-xl font-semibold">{filteredViews.length} visitas</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Visitas registradas en anuncios del centro durante el periodo.
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Oferta activa</p>
                  <p className="mt-2 text-xl font-semibold">{activeListings} anuncios</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Disponibles o reservados actualmente.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-700" />
                  Metodología CO₂e
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Factor inicial: <strong className="text-foreground">{SCHOOL_BOOK_CO2E_KG} kg CO₂e</strong> por libro escolar de 1 kg,
                  basado en una huella de producto de libro escolar verificada bajo ISO 14067.
                </p>
                <p>
                  Se contabiliza únicamente un acuerdo confirmado identificado como libro por ISBN,
                  categoría o título. Otros materiales se muestran como reutilizados, pero no reciben
                  todavía una cifra de CO₂e.
                </p>
                <p>
                  La cifra se comunica como <strong className="text-foreground">emisión potencialmente evitada</strong>:
                  presupone que la reutilización sustituye la compra de un producto nuevo equivalente.
                  No se resta de la huella de carbono propia del centro ni de Wetudy.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={CARBON_FOOTPRINT_SOURCE} target="_blank" rel="noreferrer">
                      Fuente del factor
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={GHG_PROTOCOL_SOURCE} target="_blank" rel="noreferrer">
                      Criterio GHG Protocol
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border print:border-0 print:shadow-none">
              <CardHeader>
                <CardTitle>Exportar evidencia</CardTitle>
                <CardDescription>
                  Genera una base reutilizable para memorias, subvenciones, consejo escolar o informes ESG.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button type="button" onClick={downloadCsv} className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar CSV de impacto
                </Button>
                <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
                  <a
                    href={`/api/school/impact-report?range=${range}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Exportar informe a PDF
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Informe mensual automático
                </CardTitle>
                <CardDescription>
                  Recibe por email el informe del mes anterior con el PDF adjunto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={monthlyEnabled}
                    onChange={(event) => setMonthlyEnabled(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Enviar informe todos los meses
                </label>

                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Email</span>
                    <input
                      type="email"
                      value={monthlyEmail}
                      onChange={(event) => setMonthlyEmail(event.target.value)}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      placeholder="admin@centro.es"
                    />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Día</span>
                    <select
                      value={monthlyDay}
                      onChange={(event) => setMonthlyDay(Number(event.target.value))}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {[1, 5, 10, 15, 20, 25, 28].map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={monthlySaving || monthlySending}
                    onClick={saveMonthlyReport}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {monthlySaving ? "Guardando..." : "Guardar programación"}
                  </Button>

                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={monthlySaving || monthlySending || !monthlyEmail.trim()}
                    onClick={sendMonthlyReportNow}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {monthlySending ? "Enviando..." : "Enviar informe ahora"}
                  </Button>
                </div>

                <p className="text-xs leading-5 text-muted-foreground">
                  {lastSentMonth
                    ? `Último periodo enviado: ${lastSentMonth}. El envío manual cuenta como el informe de ese mes y evita duplicados automáticos.`
                    : "Todavía no se ha enviado ningún informe mensual desde esta cuenta."}
                </p>

                {monthlyStatus ? (
                  <p className="text-xs text-muted-foreground" role="status">{monthlyStatus}</p>
                ) : null}

                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-sm font-medium">Historial de informes</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {monthlyEnabled
                      ? `Próximo envío automático: día ${monthlyDay} de cada mes.`
                      : "El envío automático está desactivado."}
                  </p>
                  <div className="mt-3 space-y-2">
                    {reportDeliveries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Todavía no hay informes registrados.</p>
                    ) : (
                      reportDeliveries.slice(0, 6).map((delivery) => (
                        <div key={delivery.id} className="flex flex-col gap-1 rounded-lg border bg-background px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{delivery.period_label}</p>
                            <p className="text-muted-foreground">{delivery.email}</p>
                          </div>
                          <div className="text-muted-foreground sm:text-right">
                            <p>{delivery.source === "cron" ? "Automático" : "Manual"}</p>
                            <p>{formatDate(delivery.sent_at)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<Package className="h-5 w-5" />}
              value={String(filteredListings.length)}
              label="Anuncios publicados"
              detail="Nuevos anuncios asociados al centro durante el periodo."
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              value={String(reusedItems)}
              label="Artículos reutilizados"
              detail="Indicador agregado de acuerdos confirmados durante el periodo."
            />
            <MetricCard
              icon={<Eye className="h-5 w-5" />}
              value={String(filteredViews.length)}
              label="Visitas registradas"
              detail="Interés medido en las fichas de los anuncios del centro."
            />
            <MetricCard
              icon={<ShieldCheck className="h-5 w-5" />}
              value={String(openReports)}
              label="Incidencias activas"
              detail="Reportes abiertos o en revisión vinculados a anuncios del centro."
            />
          </div>

        </TabsContent>

        <TabsContent value="community" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              value={String(members.length)}
              label="Miembros"
              detail="Perfiles actualmente vinculados al centro."
            />
            <MetricCard
              icon={<ShieldCheck className="h-5 w-5" />}
              value={String(schoolAdmins.length)}
              label="Administradores"
              detail="Usuarios con rol school_admin para este centro."
            />
            <MetricCard
              icon={<Package className="h-5 w-5" />}
              value={String(listings.length)}
              label="Anuncios históricos"
              detail="Publicaciones asociadas al centro."
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Administradores del centro</CardTitle>
              <CardDescription>
                La misma cuenta puede usar Wetudy normalmente y administrar el centro.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {schoolAdmins.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay administradores visibles.</p>
              ) : (
                schoolAdmins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between rounded-xl border p-3">
                    <span className="font-medium">{admin.full_name || "Administrador"}</span>
                    <Badge variant="outline">school_admin</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Acceso de la comunidad</CardTitle>
              <CardDescription>
                Código activo para que familias y usuarios vinculen su cuenta al centro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Enlace directo recomendado</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Compártelo por WhatsApp, email o web. La familia abrirá Wetudy con
                      <strong className="text-foreground"> {school?.name || "el centro"} ya seleccionado</strong>.
                    </p>
                    <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={copySchoolShareLink}>
                        <Copy className="mr-2 h-4 w-4" />
                        {copiedShareLink ? "Enlace copiado" : "Copiar enlace"}
                      </Button>
                      <Button type="button" className="w-full sm:w-auto" onClick={shareSchoolLink}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Compartir centro
                      </Button>
                    </div>
                  </div>

                  {latestAccessCode ? (
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Código alternativo</p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{latestAccessCode}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Úsalo si una familia prefiere introducir el código manualmente.
                      </p>
                      <Button type="button" variant="outline" className="mt-3 w-full sm:w-auto" onClick={copyAccessCode}>
                        <Copy className="mr-2 h-4 w-4" />
                        {copiedCode ? "Copiado" : "Copiar código"}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col items-center rounded-xl border bg-background p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <QrCode className="h-4 w-4" />
                    QR del centro
                  </div>
                  <img
                    src="/api/school/share-qr"
                    alt={`QR para unirse a ${school?.name || "este centro"} en Wetudy`}
                    className="h-52 w-52 rounded-lg bg-white p-2"
                  />
                  <p className="mt-2 max-w-52 text-center text-xs text-muted-foreground">
                    Ideal para WhatsApp, carteles, circulares y reuniones del AMPA.
                  </p>
                  <div className="mt-3 grid w-full gap-2">
                    <Button type="button" size="sm" onClick={shareSchoolQr}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Compartir QR
                    </Button>
                    <Button asChild type="button" size="sm" variant="outline">
                      <a href="/api/school/share-qr?format=png&download=1">
                        <Download className="mr-2 h-4 w-4" />
                        Descargar QR
                      </a>
                    </Button>
                    <Button asChild type="button" size="sm" variant="ghost">
                      <a href="/api/school/share-qr" target="_blank" rel="noopener noreferrer">
                        Abrir QR
                      </a>
                    </Button>
                  </div>
                  {qrShareStatus ? (
                    <p className="mt-2 max-w-52 text-center text-xs text-muted-foreground" role="status">
                      {qrShareStatus}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ficha del centro</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Centro</p>
                <p className="mt-1 font-medium">{school?.name || "Centro"}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Ubicación</p>
                <p className="mt-1 font-medium">
                  {[school?.city, school?.region].filter(Boolean).join(" · ") || "Sin ubicación"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
