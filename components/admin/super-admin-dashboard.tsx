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
  School as SchoolIcon,
  Users,
  Package,
  Heart,
  TrendingUp,
  AlertTriangle,
  MessageSquareText,
  Flag,
  Loader2,
  ExternalLink,
  School,
  CheckCircle2,
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
  email: string | null;
  phone: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: "new" | "pending" | "approved" | "rejected" | null;
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

type SuperAdminDashboardProps = {
  stats: DashboardStats;
  initialSupportTickets: SupportTicketRow[];
  initialReports: ReportListItem[];
  initialSchoolRequests: SchoolRequestRow[];
  initialApprovedRequestMeta: Record<string, ApprovedRequestMeta>;
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
  if (status === "open" || status === "pending") return "destructive";
  if (status === "in_progress" || status === "reviewing") return "secondary";
  return "outline";
}

function normalizeSchoolRequestStatus(
  status: SchoolRequestRow["status"]
): "pending" | "approved" | "rejected" {
  if (status === "approved" || status === "rejected") {
    return status;
  }

  return "pending";
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

function getRequestContactEmail(request: SchoolRequestRow) {
  return request.contact_email || request.email || "Sin email";
}

function getRequestContactPhone(request: SchoolRequestRow) {
  return request.contact_phone || request.phone || null;
}

const SUPPORT_STATUS_OPTIONS: SupportTicketRow["status"][] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

const REPORT_STATUS_OPTIONS: ReportRow["status"][] = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
];

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
}: SuperAdminDashboardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [supportTickets, setSupportTickets] =
    useState<SupportTicketRow[]>(initialSupportTickets);
  const [reports, setReports] = useState<ReportListItem[]>(initialReports);
  const [schoolRequests, setSchoolRequests] =
    useState<SchoolRequestRow[]>(initialSchoolRequests);
  const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [approvedRequestMeta, setApprovedRequestMeta] = useState<
    Record<string, ApprovedRequestMeta>
  >(initialApprovedRequestMeta);

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
      console.error("Error actualizando support ticket:", error);
      setGlobalError(
        error?.message ||
        error?.details ||
        "No se pudo actualizar el estado del ticket."
      );
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
      console.error("Error actualizando reporte:", error);
      setGlobalError(
        error?.message ||
        error?.details ||
        "No se pudo actualizar el estado del reporte."
      );
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
      console.error("Error aprobando solicitud de centro:", error);
      setGlobalError(
        error?.message ||
        error?.details ||
        "No se pudo aprobar la solicitud del centro."
      );
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
      console.error("Error rechazando solicitud de centro:", error);
      setGlobalError(
        error?.message ||
        error?.details ||
        "No se pudo rechazar la solicitud del centro."
      );
    } finally {
      setLoadingRequestId(null);
    }
  };

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <SchoolIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{stats.totalSchools}</p>
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
              <p className="text-xl font-bold text-foreground">{stats.totalUsers}</p>
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
              <p className="text-xl font-bold text-foreground">{stats.totalListings}</p>
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
              <p className="text-xl font-bold text-foreground">{stats.totalDonations}</p>
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

      <Tabs defaultValue="support" className="mt-6">
        <TabsList>
          <TabsTrigger value="support">Soporte</TabsTrigger>
          <TabsTrigger value="reports">Moderación</TabsTrigger>
          <TabsTrigger value="schools">Altas de centros</TabsTrigger>
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
              {supportTickets.length === 0 ? (
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
                          options={SUPPORT_STATUS_OPTIONS}
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
                          options={REPORT_STATUS_OPTIONS}
                          loading={loadingReportId === report.id}
                          onChange={(nextStatus) =>
                            updateReportStatus(
                              report.id,
                              nextStatus as ReportRow["status"]
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

        <TabsContent value="schools" className="mt-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                Solicitudes de centros
              </CardTitle>
              <CardDescription>
                Solicitudes enviadas desde el formulario de alta de centros.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {schoolRequests.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                    <School className="h-7 w-7 text-accent-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    Sin solicitudes
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Todavía no hay solicitudes de alta de centros.
                  </p>
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
                                Contacto: {getRequestContactEmail(request)}
                                {getRequestContactPhone(request)
                                  ? ` · ${getRequestContactPhone(request)}`
                                  : ""}
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
                              ) : request.approved_school_id ? (
                                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                  <p className="font-medium">Centro aprobado</p>
                                  <p className="mt-1 text-xs">
                                    School ID: {request.approved_school_id}
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

                          {normalizedStatus !== "approved" && normalizedStatus !== "rejected" ? (
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