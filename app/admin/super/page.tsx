import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Globe,
  School as SchoolIcon,
  Users,
  Package,
  Heart,
  TrendingUp,
  AlertTriangle,
  MessageSquareText,
  Flag,
} from "lucide-react";

const SUPERADMIN_EMAILS = ["oscar_garnelo@hotmail.com"];

type SupportTicketRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  message: string;
  status: string;
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
  status: string;
  created_at: string;
};

type ListingSummaryRow = {
  id: string;
  title: string | null;
};

type ProfileSummaryRow = {
  id: string;
  full_name: string | null;
};

type SchoolSummaryRow = {
  id: string;
};

type ListingStatsRow = {
  id: string;
  type: string | null;
  price: number | null;
};

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

function getStatusBadgeVariant(status: string) {
  if (status === "open") return "destructive";
  if (status === "in_progress" || status === "reviewing") return "secondary";
  return "outline";
}

export default async function SuperAdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/admin/super");
  }

  const email = user.email?.toLowerCase() || "";

  if (!SUPERADMIN_EMAILS.includes(email)) {
    redirect("/");
  }

  const [
    { data: profile },
    { data: schools },
    { data: profiles },
    { data: listings },
    { data: supportTickets },
    { data: reports },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("schools").select("id"),
    supabase.from("profiles").select("id"),
    supabase.from("listings").select("id, type, price"),
    supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<SupportTicketRow[]>(),
    supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<ReportRow[]>(),
  ]);

  const safeSchools = (schools || []) as SchoolSummaryRow[];
  const safeProfiles = (profiles || []) as ProfileSummaryRow[];
  const safeListings = (listings || []) as ListingStatsRow[];
  const safeSupportTickets = (supportTickets || []) as SupportTicketRow[];
  const safeReports = (reports || []) as ReportRow[];

  const listingIdsFromReports = safeReports
    .map((report) => report.listing_id)
    .filter((value): value is string => Boolean(value));

  const reporterIds = safeReports
    .map((report) => report.reporter_id)
    .filter(Boolean);

  const [{ data: reportedListings }, { data: reporterProfiles }] = await Promise.all([
    listingIdsFromReports.length > 0
      ? supabase
        .from("listings")
        .select("id, title")
        .in("id", listingIdsFromReports)
        .returns<ListingSummaryRow[]>()
      : Promise.resolve({ data: [] as ListingSummaryRow[] }),
    reporterIds.length > 0
      ? supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", reporterIds)
        .returns<ProfileSummaryRow[]>()
      : Promise.resolve({ data: [] as ProfileSummaryRow[] }),
  ]);

  const listingMap = new Map(
    ((reportedListings || []) as ListingSummaryRow[]).map((item) => [item.id, item])
  );

  const reporterMap = new Map(
    ((reporterProfiles || []) as ProfileSummaryRow[]).map((item) => [item.id, item])
  );

  const totalSchools = safeSchools.length;
  const totalUsers = safeProfiles.length;
  const totalListings = safeListings.length;
  const totalDonations = safeListings.filter((item) => item.type === "donation").length;
  const totalEstimatedVolume = safeListings.reduce(
    (sum, item) => sum + (typeof item.price === "number" ? item.price : 0),
    0
  );

  const navbarUserName =
    (typeof profile?.full_name === "string" && profile.full_name.trim().length > 0
      ? profile.full_name.trim()
      : null) || user.email || "Super Admin";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        isLoggedIn
        userName={navbarUserName}
        isAdmin
        currentUserId={user.id}
      />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Globe className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Super Admin - Wetudy
              </h1>
              <p className="text-sm text-muted-foreground">
                Panel global de soporte y moderación.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <SchoolIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalSchools}</p>
                  <p className="text-xs text-muted-foreground">Centros</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/20">
                  <Users className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Usuarios</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <Package className="h-4 w-4 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalListings}</p>
                  <p className="text-xs text-muted-foreground">Anuncios</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chart-2/10">
                  <Heart className="h-4 w-4 text-chart-2" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{totalDonations}</p>
                  <p className="text-xs text-muted-foreground">Donaciones</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chart-4/10">
                  <TrendingUp className="h-4 w-4 text-chart-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">
                    {Math.round(totalEstimatedVolume)}€
                  </p>
                  <p className="text-xs text-muted-foreground">Volumen visible</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="support" className="mt-6">
            <TabsList>
              <TabsTrigger value="support">Soporte</TabsTrigger>
              <TabsTrigger value="reports">Moderación</TabsTrigger>
            </TabsList>

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
                  {safeSupportTickets.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                        <MessageSquareText className="h-7 w-7 text-accent-foreground" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">
                        Sin tickets
                      </h3>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Todavía no hay consultas registradas en soporte.
                      </p>
                    </div>
                  ) : (
                    safeSupportTickets.map((ticket) => (
                      <Card key={ticket.id} className="border-border">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">
                                  {ticket.name}
                                </p>
                                <Badge variant={getStatusBadgeVariant(ticket.status)}>
                                  {ticket.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {ticket.email}
                              </p>
                              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                                {ticket.message}
                              </p>
                            </div>

                            <div className="shrink-0 text-xs text-muted-foreground">
                              {formatDate(ticket.created_at)}
                            </div>
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
                  {safeReports.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                        <AlertTriangle className="h-7 w-7 text-accent-foreground" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">
                        Sin incidencias
                      </h3>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        No hay contenido reportado ni disputas pendientes.
                      </p>
                    </div>
                  ) : (
                    safeReports.map((report) => {
                      const reporterName =
                        reporterMap.get(report.reporter_id)?.full_name?.trim() ||
                        "Usuario";
                      const reportedListingTitle =
                        report.listing_id
                          ? listingMap.get(report.listing_id)?.title || "Anuncio"
                          : null;

                      return (
                        <Card key={report.id} className="border-border">
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={getStatusBadgeVariant(report.status)}>
                                    {report.status}
                                  </Badge>
                                  <Badge variant="outline">
                                    {report.target_type === "listing"
                                      ? "Anuncio"
                                      : "Chat"}
                                  </Badge>
                                  <span className="text-sm font-medium text-foreground">
                                    {getReasonLabel(report.reason)}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm text-muted-foreground">
                                  Reportado por: {reporterName}
                                </p>

                                {report.target_type === "listing" ? (
                                  <p className="text-sm text-muted-foreground">
                                    Anuncio: {reportedListingTitle}
                                  </p>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
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
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}