import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SavedSearchesList } from "@/components/account/saved-searches-list";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/saved-searches");

  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, query, isbn_query, category, grade_level, listing_type, condition, only_my_community, results_count, notifications_enabled, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error cargando búsquedas guardadas:", error);
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-8 lg:px-8">
        <Button asChild variant="ghost" className="mb-4 gap-2 px-0">
          <Link href="/account"><ArrowLeft className="h-4 w-4" /> Mi cuenta</Link>
        </Button>

        <div className="mb-6 rounded-3xl border bg-background p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary"><Search className="h-4 w-4" /> Demanda guardada</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Mis búsquedas</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Guarda materiales que todavía no aparecen para retomarlos más tarde y ayudarnos a entender qué falta en la comunidad.
              </p>
            </div>
            <Button asChild><Link href="/marketplace">Buscar material</Link></Button>
          </div>
        </div>

        <SavedSearchesList initialSearches={(data || []) as any} />
      </div>
    </div>
  );
}
