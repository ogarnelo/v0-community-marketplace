import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

function getStatusClass(status: string) {
  switch (status) {
    case "open":
      return "bg-amber-100 text-amber-800";
    case "reviewing":
      return "bg-sky-100 text-sky-800";
    case "resolved":
      return "bg-emerald-100 text-emerald-800";
    case "closed":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default async function IssuesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: issues } = await supabase
    .from("transaction_issues")
    .select("id, payment_intent_id, listing_id, title, description, status, created_at, opened_by, buyer_id, seller_id")
    .or(`opened_by.eq.${user.id},buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const listingIds = Array.from(new Set((issues || []).map((issue: any) => issue.listing_id).filter(Boolean)));

  const { data: listings } =
    listingIds.length > 0
      ? await supabase.from("listings").select("id, title").in("id", listingIds)
      : { data: [] };

  const listingMap = new Map((listings || []).map((listing: any) => [listing.id, listing.title]));

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Incidencias</h1>
        <p className="mt-2 text-muted-foreground">
          Consulta los problemas abiertos o cerrados relacionados con tus compras y ventas.
        </p>
      </div>

      <div className="space-y-4">
        {(issues || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">No tienes incidencias</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Si tienes un problema con una operación pagada, podrás abrir una incidencia desde tu actividad o chat.
            </p>
          </div>
        ) : (
          issues!.map((issue: any) => (
            <Link
              key={issue.id}
              href={`/account/issues/${issue.id}`}
              className="block rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(issue.status)}`}>
                      {getStatusLabel(issue.status)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(issue.created_at).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold">{issue.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {listingMap.get(issue.listing_id) || "Operación"}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {issue.description}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
