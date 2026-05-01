import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CloseTransactionIssueButton from "@/components/issues/close-transaction-issue-button";

function getStatusLabel(status: string) {
  switch (status) {
    case "open":
      return "Abierta";
    case "reviewing":
      return "En revisión";
    case "resolved":
      return "Resuelta";
    case "closed":
      return "Cerrada";
    default:
      return status;
  }
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: issue } = await supabase
    .from("transaction_issues")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!issue || ![issue.opened_by, issue.buyer_id, issue.seller_id].includes(user.id)) {
    notFound();
  }

  const { data: listing } = issue.listing_id
    ? await supabase.from("listings").select("id, title").eq("id", issue.listing_id).maybeSingle()
    : { data: null };

  const canClose = issue.opened_by === user.id && ["open", "reviewing"].includes(issue.status);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link href="/account/issues" className="text-sm font-medium text-primary hover:underline">
        ← Volver a incidencias
      </Link>

      <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              {getStatusLabel(issue.status)}
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">{issue.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {listing?.title || "Operación"} · creada el{" "}
              {new Date(issue.created_at).toLocaleString("es-ES")}
            </p>
          </div>

          {canClose ? <CloseTransactionIssueButton issueId={issue.id} /> : null}
        </div>

        <div className="rounded-xl bg-muted p-4">
          <h2 className="text-sm font-semibold">Descripción</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {issue.description}
          </p>
        </div>

        {issue.resolution_note ? (
          <div className="mt-4 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">Resolución</h2>
            <p className="mt-2 text-sm text-muted-foreground">{issue.resolution_note}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {issue.conversation_id ? (
            <Link
              href={`/messages/${issue.conversation_id}`}
              className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Ir al chat
            </Link>
          ) : null}
          {issue.listing_id ? (
            <Link
              href={`/marketplace/listing/${issue.listing_id}`}
              className="inline-flex rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Ver anuncio
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
