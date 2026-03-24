"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Euro,
  ExternalLink,
  Flag,
  Heart,
  Loader2,
  MessageSquareText,
  Package,
  School,
  School as SchoolIcon,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

type SupportTicketRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: "listing" | "conversation";
  listing_id: string | null;
  conversation_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
};

type SchoolRequestRow = {
  id: string;
  school_name: string;
  school_type: string | null;
  address: string;
  city: string;
  postal_code: string;
  region: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: "pending" | "approved" | "rejected" | "new" | null;
  review_notes: string | null;
  approved_school_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type DashboardStats = {
  totalSchools: number;
  totalUsers: number;
  totalListings: number;
  totalDonations: number;
  totalEstimatedVolume: number;
};

type ReportListItem = ReportRow & {
  reporter_name: string;
  listing_title: string | null;
};

type ApprovedRequestMeta = {
  schoolId: string;
  accessCode: string;
};

type SchoolSummaryRow = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  school_type: string | null;
};

type ProfileSummaryRow = {
  id: string;
  full_name: string | null;
  school_id: string | null;
};

type ListingStatsRow = {
  id: string;
  type: string | null;
  price: number | null;
  status: string | null;
  school_id: string | null;
  created_at: string;
};

type SuperAdminDashboardProps = {
  stats: DashboardStats;
  initialSupportTickets: SupportTicketRow[];
  initialReports: ReportListItem[];
  initialSchoolRequests: SchoolRequestRow[];
  initialApprovedRequestMeta: Record<string, ApprovedRequestMeta>;
  initialSchools: SchoolSummaryRow[];
  initialProfiles: ProfileSummaryRow[];
  initialListings: ListingStatsRow[];
};

const supportStatusChartConfig = {
  total: { label: "Tickets" },
  open: { label: "Abiertos", color: "hsl(var(--chart-5))" },
  in_progress: { label: "En curso", color: "hsl(var(--chart-4))" },
  resolved: { label: "Resueltos", color: "hsl(var(--chart-2))" },
  closed: { label: "Cerrados", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const reportStatusChartConfig = {
  total: { label: "Reports" },
  open: { label: "Abiertos", color: "hsl(var(--chart-5))" },
  reviewing: { label: "Revisando", color: "hsl(var(--chart-4))" },
  resolved: { label: "Resueltos", color: "hsl(var(--chart-2))" },
  dismissed: { label: "Descartados", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const requestStatusChartConfig = {
  total: { label: "Solicitudes" },
  pending: { label: "Pendientes", color: "hsl(var(--chart-4))" },
  approved: { label: "Aprobadas", color: "hsl(var(--chart-2))" },
  rejected: { label: "Rechazadas", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const listingTypeChartConfig = {
  total: { label: "Anuncios" },
  sale: { label: "Venta", color: "hsl(var(--chart-1))" },
  donation: { label: "Donación", color: "hsl(var(--chart-2))" },
  exchange: { label: "Intercambio", color: "hsl(var(--chart-4))" },
  other: { label: "Otros", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

const growthChartConfig = {
  listings: { label: "Anuncios", color: "hsl(var(--chart-1))" },
  support: { label: "Tickets", color: "hsl(var(--chart-4))" },
  reports: { label: "Reports", color: "hsl(var(--chart-5))" },
  requests: { label: "Solicitudes", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

function formatDate(date: string | null) {
  if (!date) return "Sin fecha";

  return new Date(date).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReasonLabel(reason: string) {
  switch (reason) {
    case "spam":
      return "Spam";
    case "fraude":
      return "Fraude o estafa";
    case "descripcion_enganosa":
      return "Descripción engañosa";
    case "contenido_inapropiado":
      return "Contenido inapropiado";
    case "acoso":
      return "Acoso o trato inapropiado";
    case "otro":
      return "Otro";
    default:
      return reason;
  }
}

function getSchoolTypeLabel(schoolType?: string | null) {
  switch (schoolType) {
    case "school":
      return "Colegio / Instituto";
    case "academy":
      return "Academia";
    case "university":
      return "Universidad";
    default:
      return "Sin definir";
  }
}

function getStatusBadgeVariant(status: string) {
  if (status === "open" || status === "pending") return "destructive" as const;
  if (status === "in_progress" || status === "reviewing") return "secondary" as const;
  return "outline" as const;
}

function normalizeSchoolRequestStatus(
  status: SchoolRequestRow["status"]
): "pending" | "approved" | "rejected" {
  if (status === "approved" || status === "rejected") {
    return status;
  }

  return "pending";
}

function monthKey(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    month: "short",
    year: "2-digit",
  }).format(parsed);
}

function buildMonthlySeries({
  listings,
  supportTickets,
  reports,
  requests,
}: {
  listings: ListingStatsRow[];
  supportTickets: SupportTicketRow[];
  reports: ReportListItem[];
  requests: SchoolRequestRow[];
}) {
  const buckets = new Map<
    string,
    {
      month: string;
      listings: number;
      support: number;
      reports: number;
      requests: number;
    }
  >();

  const add = (date: string, key: "listings" | "support" | "reports" | "requests") => {
    const bucketKey = monthKey(date);
    const current = buckets.get(bucketKey) || {
      month: bucketKey,
      listings: 0,
      support: 0,
      reports: 0,
      requests: 0,
    };

    current[key] += 1;
    buckets.set(bucketKey, current);
  };

  listings.forEach((item) => add(item.created_at, "listings"));
  supportTickets.forEach((item) => add(item.created_at, "support"));
  reports.forEach((item) => add(item.created_at, "reports"));
  requests.forEach((item) => add(item.created_at, "requests"));

  return Array.from(buckets.values()).slice(-6);
}

function StatusActionGroup({
  currentStatus,
  options,
  loading,
  onChange,
}: {
  currentStatus: string;
  options: string[];
  loading: boolean;
  onChange: (nextStatus: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((status) => {
        const isActive = currentStatus === status;

        return (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={isActive ? "default" : "outline"}
            disabled={loading || isActive}
            onClick={() => onChange(status)}
            className="h-8"
          >
            {loading && isActive ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {status}
          </Button>
        );
      })}
    </div>
  );
}

export default function SuperAdminDashboard({
  stats,
  initialSupportTickets,
  initialReports,
  initialSchoolRequests,
  initialApprovedRequestMeta,
  initialSchools,
  initialProfiles,
  initialListings,
}: SuperAdminDashboardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [supportTickets, setSupportTickets] = useState(initialSupportTickets);
  const [reports, setReports] = useState(initialReports);
  const [schoolRequests, setSchoolRequests] = useState(initialSchoolRequests);
  const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [approvedRequestMeta, setApprovedRequestMeta] = useState<
    Record<string, ApprovedRequestMeta>
  >(initialApprovedRequestMeta);

  const schoolSummaries = useMemo(() => {
    const bySchoolId = new Map<
      string,
      { members: number; listings: number; donations: number; salesVolume: number }
    >();

    initialSchools.forEach((school) => {
      bySchoolId.set(school.id, {
        members: 0,
        listings: 0,
        donations: 0,
        salesVolume: 0,
      });
    });

    initialProfiles.forEach((profile) => {
      if (!profile.school_id || !bySchoolId.has(profile.school_id)) return;
      bySchoolId.get(profile.school_id)!.members += 1;
    });

    initialListings.forEach((listing) => {
      if (!listing.school_id || !bySchoolId.has(listing.school_id)) return;

      const bucket = bySchoolId.get(listing.school_id)!;
      bucket.listings += 1;

      if (listing.type === "donation") {
        bucket.donations += 1;
      }

      if (typeof listing.price === "number") {
        bucket.salesVolume += listing.price;
      }
    });

    return initialSchools
      .map((school) => ({
        ...school,
        ...(bySchoolId.get(school.id) || {
          members: 0,
          listings: 0,
          donations: 0,
          salesVolume: 0,
        }),
      }))
      .sort((a, b) => b.members - a.members || b.listings - a.listings)
      .slice(0, 5);
  }, [initialListings, initialProfiles, initialSchools]);

  const supportStatusData = useMemo(
    () =>
      ["open", "in_progress", "resolved", "closed"].map((status) => ({
        status,
        total: supportTickets.filter((ticket) => ticket.status === status).length,
        fill: `var(--color-${status})`,
      })),
    [supportTickets]
  );

  const reportStatusData = useMemo(
    () =>
      ["open", "reviewing", "resolved", "dismissed"].map((status) => ({
        status,
        total: reports.filter((report) => report.status === status).length,
        fill: `var(--color-${status})`,
      })),
    [reports]
  );

  const requestStatusData = useMemo(
    () =>
      ["pending", "approved", "rejected"].map((status) => ({
        status,
        total: schoolRequests.filter(
          (request) => normalizeSchoolRequestStatus(request.status) === status
        ).length,
        fill: `var(--color-${status})`,
      })),
    [schoolRequests]
  );

  const listingTypeData = useMemo(() => {
    const types = ["sale", "donation", "exchange"] as const;

    const values = types.map((type) => ({
      type,
      total: initialListings.filter((listing) => listing.type === type).length,
      fill: `var(--color-${type})`,
    }));

    const knownTotal = values.reduce((sum, item) => sum + item.total, 0);
    const otherTotal = initialListings.length - knownTotal;

    return [
      ...values,
      {
        type: "other",
        total: Math.max(otherTotal, 0),
        fill: "var(--color-other)",
      },
    ];
  }, [initialListings]);

  const growthData = useMemo(
    () =>
      buildMonthlySeries({
        listings: initialListings,
        supportTickets,
        reports,
        requests: schoolRequests,
      }),
    [initialListings, reports, schoolRequests, supportTickets]
  );

  const openIncidents =
    supportTickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress")
      .length +
    reports.filter((report) => report.status === "open" || report.status === "reviewing").length;

  const approvalRate =
    schoolRequests.length > 0
      ? Math.round(
        (schoolRequests.filter(
          (request) => normalizeSchoolRequestStatus(request.status) === "approved"
        ).length /
          schoolRequests.length) *
        100
      )
      : 0;

  const updateSupportTicketStatus = async (
    ticketId: string,
    nextStatus: SupportTicketRow["status"]
  ) => {
    setGlobalError("");
    setLoadingTicketId(ticketId);

    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: nextStatus })
        .eq("id", ticketId);

      if (error) throw error;

      setSupportTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, status: nextStatus } : ticket
        )
      );
    } catch (error: any) {
      setGlobalError(error?.message || error?.details || "No se pudo actualizar el ticket.");
    } finally {
      setLoadingTicketId(null);
    }
  };

  const updateReportStatus = async (
    reportId: string,
    nextStatus: ReportRow["status"]
  ) => {
    setGlobalError("");
    setLoadingReportId(reportId);

    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: nextStatus })
        .eq("id", reportId);

      if (error) throw error;

      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId ? { ...report, status: nextStatus } : report
        )
      );
    } catch (error: any) {
      setGlobalError(error?.message || error?.details || "No se pudo actualizar el reporte.");
    } finally {
      setLoadingReportId(null);
    }
  };

  const approveSchoolRequest = async (requestId: string) => {
    setGlobalError("");
    setLoadingRequestId(requestId);

    try {
      const { data, error } = await supabase.rpc(
        "approve_school_registration_request",
        { request_id: requestId }
      );

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      setSchoolRequests((prev) =>
        prev.map((request) =>
          request.id === requestId
            ? {
              ...request,
              status: "approved",
              approved_school_id: result?.school_id || request.approved_school_id,
              reviewed_at: new Date().toISOString(),
            }
            : request
        )
      );

      if (result?.school_id && result?.access_code) {
        setApprovedRequestMeta((prev) => ({
          ...prev,
          [requestId]: {
            schoolId: result.school_id,
            accessCode: result.access_code,
          },
        }));
      }
    } catch (error: any) {
      setGlobalError(error?.message || error?.details || "No se pudo aprobar la solicitud.");
    } finally {
      setLoadingRequestId(null);
    }
  };

  const rejectSchoolRequest = async (requestId: string) => {
    setGlobalError("");
    setLoadingRequestId(requestId);

    try {
      const { error } = await supabase.rpc("reject_school_registration_request", {
        request_id: requestId,
        notes: null,
      });

      if (error) throw error;

      setSchoolRequests((prev) =>
        prev.map((request) =>
          request.id === requestId
            ? {
              ...request,
              status: "rejected",
              reviewed_at: new Date().toISOString(),
            }
            : request
        )
      );
    } catch (error: any) {
      setGlobalError(error?.message || error?.details || "No se pudo rechazar la solicitud.");
    } finally {
      setLoadingRequestId(null);
    }
  };

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <SchoolIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalSchools}</p>
              <p className="text-xs text-muted-foreground">Centros activos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20">
              <Users className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Usuarios</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Package className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalListings}</p>
              <p className="text-xs text-muted-foreground">Anuncios</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
              <Heart className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalDonations}</p>
              <p className="text-xs text-muted-foreground">Donaciones</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-5/10">
              <AlertTriangle className="h-5 w-5 text-chart-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{openIncidents}</p>
              <p className="text-xs text-muted-foreground">Incidencias abiertas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <Euro className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(stats.totalEstimatedVolume)}€
              </p>
              <p className="text-xs text-muted-foreground">Volumen visible</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {globalError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {globalError}
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Dashboard</TabsTrigger>
          <TabsTrigger value="support">Soporte</TabsTrigger>
          <TabsTrigger value="reports">Moderación</TabsTrigger>
          <TabsTrigger value="schools">Altas de centros</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-border xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Actividad operativa reciente
                </CardTitle>
                <CardDescription>
                  Evolución combinada de anuncios, soporte, reports y solicitudes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={growthChartConfig} className="h-[280px] w-full">
                  <LineChart data={growthData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="listings"
                      stroke="var(--color-listings)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="support"
                      stroke="var(--color-support)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="reports"
                      stroke="var(--color-reports)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="requests"
                      stroke="var(--color-requests)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>KPIs ejecutivos</CardTitle>
                <CardDescription>Resumen rápido para priorizar trabajo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tasa de aprobación
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{approvalRate}%</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sobre {schoolRequests.length} solicitudes registradas.
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tickets a mover
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {
                      supportTickets.filter(
                        (ticket) => ticket.status === "open" || ticket.status === "in_progress"
                      ).length
                    }
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Abiertos o en curso.
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Reports activos
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {
                      reports.filter(
                        (report) =>
                          report.status === "open" || report.status === "reviewing"
                      ).length
                    }
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Contenido en revisión.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Tickets por estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={supportStatusChartConfig} className="mx-auto h-[220px]">
                  <PieChart>
                    <ChartTooltip
                      content={<ChartTooltipContent nameKey="status" hideLabel />}
                    />
                    <Pie
                      data={supportStatusData}
                      dataKey="total"
                      nameKey="status"
                      innerRadius={55}
                      outerRadius={85}
                    >
                      {supportStatusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Reports por estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={reportStatusChartConfig} className="mx-auto h-[220px]">
                  <PieChart>
                    <ChartTooltip
                      content={<ChartTooltipContent nameKey="status" hideLabel />}
                    />
                    <Pie
                      data={reportStatusData}
                      dataKey="total"
                      nameKey="status"
                      innerRadius={55}
                      outerRadius={85}
                    >
                      {reportStatusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Solicitudes de centros</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={requestStatusChartConfig} className="mx-auto h-[220px]">
                  <BarChart data={requestStatusData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="status" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" radius={8}>
                      {requestStatusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Tipos de anuncio</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={listingTypeChartConfig} className="mx-auto h-[220px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="type" hideLabel />} />
                    <Pie
                      data={listingTypeData}
                      dataKey="total"
                      nameKey="type"
                      innerRadius={55}
                      outerRadius={85}
                    >
                      {listingTypeData.map((entry) => (
                        <Cell key={entry.type} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="type" />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Centros con más comunidad
                </CardTitle>
                <CardDescription>Top centros por miembros y catálogo publicado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {schoolSummaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay centros para analizar.
                  </p>
                ) : (
                  schoolSummaries.map((school) => (
                    <div key={school.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{school.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {school.city || "Ciudad"}
                            {school.region ? ` · ${school.region}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {getSchoolTypeLabel(school.school_type)}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">Miembros</p>
                          <p className="mt-1 font-semibold text-foreground">
                            {school.members}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">Anuncios</p>
                          <p className="mt-1 font-semibold text-foreground">
                            {school.listings}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground">Volumen</p>
                          <p className="mt-1 font-semibold text-foreground">
                            {Math.round(school.salesVolume)}€
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Prioridades del día</CardTitle>
                <CardDescription>Resumen accionable para soporte y moderación.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Tickets pendientes de mover
                      </p>
                      <p className="text-xs text-muted-foreground">Abiertos o en curso</p>
                    </div>
                    <Badge variant="secondary">
                      {
                        supportTickets.filter(
                          (ticket) =>
                            ticket.status === "open" || ticket.status === "in_progress"
                        ).length
                      }
                    </Badge>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Reports activos</p>
                      <p className="text-xs text-muted-foreground">Abiertos o revisándose</p>
                    </div>
                    <Badge variant="destructive">
                      {
                        reports.filter(
                          (report) =>
                            report.status === "open" || report.status === "reviewing"
                        ).length
                      }
                    </Badge>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Altas de centros por revisar
                      </p>
                      <p className="text-xs text-muted-foreground">Solicitudes pendientes</p>
                    </div>
                    <Badge variant="outline">
                      {
                        schoolRequests.filter(
                          (request) =>
                            normalizeSchoolRequestStatus(request.status) === "pending"
                        ).length
                      }
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="support" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5" />
                Support tickets
              </CardTitle>
              <CardDescription>
                Consultas enviadas desde el centro de ayuda.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {supportTickets.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Todavía no hay tickets registrados.
                </div>
              ) : (
                supportTickets.map((ticket) => (
                  <Card key={ticket.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground">{ticket.name}</p>
                              <Badge variant={getStatusBadgeVariant(ticket.status)}>
                                {ticket.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{ticket.email}</p>
                            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                              {ticket.message}
                            </p>
                          </div>

                          <div className="shrink-0 text-xs text-muted-foreground">
                            {formatDate(ticket.created_at)}
                          </div>
                        </div>

                        <StatusActionGroup
                          currentStatus={ticket.status}
                          options={["open", "in_progress", "resolved", "closed"]}
                          loading={loadingTicketId === ticket.id}
                          onChange={(nextStatus) =>
                            updateSupportTicketStatus(
                              ticket.id,
                              nextStatus as SupportTicketRow["status"]
                            )
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Reports
              </CardTitle>
              <CardDescription>
                Reportes enviados por los usuarios sobre anuncios y chats.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {reports.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No hay incidencias registradas.
                </div>
              ) : (
                reports.map((report) => (
                  <Card key={report.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={getStatusBadgeVariant(report.status)}>
                                {report.status}
                              </Badge>
                              <Badge variant="outline">
                                {report.target_type === "listing" ? "Anuncio" : "Chat"}
                              </Badge>
                              <span className="text-sm font-medium text-foreground">
                                {getReasonLabel(report.reason)}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-muted-foreground">
                              Reportado por: {report.reporter_name}
                            </p>

                            {report.target_type === "listing" ? (
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span>Anuncio: {report.listing_title || "Anuncio"}</span>
                                {report.listing_id ? (
                                  <Link
                                    href={`/marketplace/listing/${report.listing_id}`}
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    Ver anuncio
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Link>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Conversación: {report.conversation_id}
                              </p>
                            )}

                            {report.details ? (
                              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                                {report.details}
                              </p>
                            ) : (
                              <p className="mt-3 text-sm text-muted-foreground">
                                Sin detalles adicionales.
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 text-xs text-muted-foreground">
                            {formatDate(report.created_at)}
                          </div>
                        </div>

                        <StatusActionGroup
                          currentStatus={report.status}
                          options={["open", "reviewing", "resolved", "dismissed"]}
                          loading={loadingReportId === report.id}
                          onChange={(nextStatus) =>
                            updateReportStatus(report.id, nextStatus as ReportRow["status"])
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schools" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                Solicitudes de centros
              </CardTitle>
              <CardDescription>
                Altas enviadas desde el formulario de centros.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {schoolRequests.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Todavía no hay solicitudes de alta.
                </div>
              ) : (
                schoolRequests.map((request) => {
                  const normalizedStatus = normalizeSchoolRequestStatus(request.status);
                  const approvedMeta = approvedRequestMeta[request.id];

                  return (
                    <Card key={request.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">
                                  {request.school_name}
                                </p>
                                <Badge variant={getStatusBadgeVariant(normalizedStatus)}>
                                  {normalizedStatus}
                                </Badge>
                                <Badge variant="outline">
                                  {getSchoolTypeLabel(request.school_type)}
                                </Badge>
                              </div>

                              <p className="mt-1 text-sm text-muted-foreground">
                                {request.city} · {request.region} · {request.postal_code}
                              </p>

                              <p className="text-sm text-muted-foreground">
                                {request.address}
                              </p>

                              <p className="mt-2 text-sm text-muted-foreground">
                                Contacto: {request.contact_email || "Sin email"}
                                {request.contact_phone ? ` · ${request.contact_phone}` : ""}
                              </p>

                              {approvedMeta ? (
                                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                  <p className="font-medium">Centro aprobado</p>
                                  <p className="mt-1">
                                    Código generado:{" "}
                                    <span className="font-mono font-semibold">
                                      {approvedMeta.accessCode}
                                    </span>
                                  </p>
                                  <p className="mt-1 text-xs">
                                    School ID: {approvedMeta.schoolId}
                                  </p>
                                </div>
                              ) : null}

                              {request.review_notes ? (
                                <p className="mt-3 text-sm text-muted-foreground">
                                  Notas: {request.review_notes}
                                </p>
                              ) : null}
                            </div>

                            <div className="shrink-0 text-xs text-muted-foreground">
                              {formatDate(request.created_at)}
                            </div>
                          </div>

                          {normalizedStatus !== "approved" &&
                            normalizedStatus !== "rejected" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={loadingRequestId === request.id}
                                onClick={() => approveSchoolRequest(request.id)}
                              >
                                {loadingRequestId === request.id ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                )}
                                Aprobar y crear centro
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={loadingRequestId === request.id}
                                onClick={() => rejectSchoolRequest(request.id)}
                              >
                                <XCircle className="mr-2 h-3.5 w-3.5" />
                                Rechazar
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}