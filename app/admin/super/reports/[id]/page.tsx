import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquareText, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportStatusControls } from "@/components/admin/report-status-controls";
import { getOfferChatPreview } from "@/lib/offers/chat-message";
import { getDonationChatPreview } from "@/lib/donations/chat-message";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  if (status === "open") return "Abierta";
  if (status === "reviewing") return "En revisión";
  if (status === "resolved") return "Resuelta";
  if (status === "dismissed") return "Descartada";
  return status;
}

function reasonLabel(reason: string) {
  if (reason === "agreement_dispute") return "Incidencia del acuerdo";
  if (reason === "fraude") return "Fraude o estafa";
  if (reason === "acoso") return "Acoso o trato inapropiado";
  if (reason === "contenido_inapropiado") return "Contenido inapropiado";
  if (reason === "spam") return "Spam";
  return reason || "Reporte";
}

function friendlyMessage(body?: string | null) {
  const value = body?.trim() || "";
  if (!value) return "Mensaje sin texto";
  return getOfferChatPreview(value) || getDonationChatPreview(value) || value;
}

export default async function SuperAdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth?next=${encodeURIComponent(`/admin/super/reports/${id}`)}`);

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1);

  if (!roles?.length) redirect("/");

  const navbarData = await getNavbarData(supabase);
  const admin = createAdminClient();
  const { data: report } = await admin.from("reports").select("*").eq("id", id).maybeSingle();

  if (!report) notFound();

  const [{ data: agreement }, { data: listing }, { data: messages }, { data: reviews }] =
    await Promise.all([
      report.agreement_id
        ? admin.from("agreements").select("*").eq("id", report.agreement_id).maybeSingle()
        : Promise.resolve({ data: null }),
      report.listing_id
        ? admin.from("listings").select("id, title, status, type, listing_type, price").eq("id", report.listing_id).maybeSingle()
        : Promise.resolve({ data: null }),
      report.conversation_id
        ? admin
            .from("messages")
            .select("id, sender_id, body, attachment_name, created_at")
            .eq("conversation_id", report.conversation_id)
            .order("created_at", { ascending: true })
            .limit(150)
        : Promise.resolve({ data: [] }),
      report.agreement_id
        ? admin
            .from("agreement_reviews")
            .select("id, reviewer_id, reviewed_user_id, rating, comment, created_at")
            .eq("agreement_id", report.agreement_id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  const participantIds = Array.from(
    new Set(
      [
        report.reporter_id,
        agreement?.buyer_id,
        agreement?.seller_id,
        ...(messages || []).map((message: any) => message.sender_id),
        ...(reviews || []).flatMap((review: any) => [review.reviewer_id, review.reviewed_user_id]),
      ].filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const { data: profiles } = participantIds.length
    ? await admin.from("profiles").select("id, full_name, business_name").in("id", participantIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles || []).map((profile: any) => [
      profile.id,
      profile.business_name?.trim() || profile.full_name?.trim() || "Usuario de Wetudy",
    ])
  );

  const reporterName = profileMap.get(report.reporter_id) || "Usuario de Wetudy";
  const buyerName = agreement?.buyer_id ? profileMap.get(agreement.buyer_id) || "Comprador" : null;
  const sellerName = agreement?.seller_id ? profileMap.get(agreement.seller_id) || "Vendedor" : null;
  const listingTitle = listing?.title || "Anuncio";

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Navbar {...navbarData} />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
          <Button asChild variant="ghost" className="mb-4 -ml-2 gap-2">
            <Link href="/admin/super?tab=reports">
              <ArrowLeft className="h-4 w-4" />
              Volver a incidencias
            </Link>
          </Button>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{statusLabel(report.status)}</Badge>
                <Badge variant="outline">
                  {report.target_type === "agreement"
                    ? "Acuerdo"
                    : report.target_type === "conversation"
                      ? "Chat"
                      : "Anuncio"}
                </Badge>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                {reasonLabel(report.reason)}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Reportado por {reporterName} · {formatDate(report.created_at)}
              </p>
            </div>

            <ReportStatusControls
              reportId={report.id}
              initialStatus={report.status}
              initialResolutionNote={report.resolution_note}
            />
          </div>

          <div className="grid gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Qué ha ocurrido</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {report.details?.trim() || "La persona no añadió una explicación."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contexto del acuerdo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Anuncio</p>
                  <p className="mt-1 font-medium">{listingTitle}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Partes</p>
                  <p className="mt-1 font-medium">
                    {buyerName && sellerName ? `${buyerName} ↔ ${sellerName}` : "Sin acuerdo asociado"}
                  </p>
                </div>
                {agreement ? (
                  <>
                    <div className="rounded-xl border p-3">
                      <p className="text-xs text-muted-foreground">Tipo / estado</p>
                      <p className="mt-1 font-medium">
                        {agreement.agreement_type === "donation" ? "Donación" : "Venta"} · {agreement.status}
                      </p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-xs text-muted-foreground">Importe acordado</p>
                      <p className="mt-1 font-medium">
                        {typeof agreement.amount === "number" ? `${agreement.amount.toFixed(2)} €` : "No aplica"}
                      </p>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            {reviews && reviews.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Valoraciones del acuerdo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {profileMap.get(review.reviewer_id) || "Usuario"} → {profileMap.get(review.reviewed_user_id) || "Usuario"}
                        </p>
                        <span className="inline-flex items-center gap-1 text-sm font-medium">
                          <Star className="h-4 w-4" />
                          {review.rating}/5
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {review.comment?.trim() || "Sin comentario."}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5" />
                  Historial del chat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!messages || messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay mensajes asociados.</p>
                ) : (
                  messages.map((message: any) => (
                    <div key={message.id} className="rounded-xl border bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {profileMap.get(message.sender_id) || "Usuario"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(message.created_at)}</p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {friendlyMessage(message.body)}
                      </p>
                      {message.attachment_name ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Adjunto: {message.attachment_name}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
