import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bell, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SavedSearchesList } from "@/components/account/saved-searches-list";
import { SavedSearchMatchesList } from "@/components/account/saved-search-matches-list";

export const dynamic = "force-dynamic";

type MatchRow = {
  id: string;
  listing_id: string;
  saved_search_id: string;
  matched_at: string;
};

type MatchListing = {
  id: string;
  title: string | null;
  status: string | null;
  category: string | null;
  grade_level: string | null;
  condition: string | null;
};

type MatchSearch = {
  id: string;
  query: string | null;
  isbn_query: string | null;
  category: string | null;
  grade_level: string | null;
};

export default async function SavedSearchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/account/saved-searches");

  const [savedSearchesResult, matchesResult] = await Promise.all([
    supabase
      .from("saved_searches")
      .select("id, query, isbn_query, category, grade_level, listing_type, condition, only_my_community, results_count, notifications_enabled, intent_source, demand_request_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("saved_search_matches")
      .select("id, listing_id, saved_search_id, matched_at")
      .eq("user_id", user.id)
      .order("matched_at", { ascending: false })
      .limit(20)
      .returns<MatchRow[]>(),
  ]);

  if (savedSearchesResult.error) {
    console.error("Error cargando búsquedas guardadas:", savedSearchesResult.error);
  }
  if (matchesResult.error) {
    console.error("Error cargando coincidencias guardadas:", matchesResult.error);
  }

  const savedSearches = savedSearchesResult.data || [];
  const courseNeedDemandIds = Array.from(
    new Set(
      savedSearches
        .filter((search: any) => search.intent_source === "course_need" && search.demand_request_id)
        .map((search: any) => search.demand_request_id as string)
    )
  );

  let activeCourseNeedDemandIds = new Set<string>();
  if (courseNeedDemandIds.length > 0) {
    const { data: activeCourseNeeds, error: activeCourseNeedsError } = await supabase
      .from("course_needs")
      .select("demand_request_id")
      .eq("owner_user_id", user.id)
      .eq("status", "active")
      .in("demand_request_id", courseNeedDemandIds);

    if (activeCourseNeedsError) {
      console.error("Error cargando búsquedas de Mi curso activas:", activeCourseNeedsError);
    } else {
      activeCourseNeedDemandIds = new Set(
        (activeCourseNeeds || [])
          .map((need: any) => need.demand_request_id)
          .filter((id: string | null): id is string => Boolean(id))
      );
    }
  }

  const visibleSavedSearches = savedSearches.filter(
    (search: any) =>
      search.intent_source !== "course_need" ||
      (search.demand_request_id && activeCourseNeedDemandIds.has(search.demand_request_id))
  );

  const matches = matchesResult.data || [];
  const listingIds = Array.from(new Set(matches.map((match) => match.listing_id)));
  const searchIds = Array.from(new Set(matches.map((match) => match.saved_search_id)));

  let listings: MatchListing[] = [];
  let matchedSearches: MatchSearch[] = [];

  if (listingIds.length > 0) {
    const { data } = await supabase
      .from("listings")
      .select("id, title, status, category, grade_level, condition")
      .in("id", listingIds)
      .returns<MatchListing[]>();
    listings = data || [];
  }

  if (searchIds.length > 0) {
    const { data } = await supabase
      .from("saved_searches")
      .select("id, query, isbn_query, category, grade_level")
      .eq("user_id", user.id)
      .in("id", searchIds)
      .returns<MatchSearch[]>();
    matchedSearches = data || [];
  }

  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const searchById = new Map(matchedSearches.map((search) => [search.id, search]));
  const visibleMatches = matches
    .map((match) => ({
      ...match,
      listing: listingById.get(match.listing_id),
      search: searchById.get(match.saved_search_id),
    }))
    .filter((match) => match.listing?.status === "available");

  const matchItems = visibleMatches.map((match) => {
    const listing = match.listing!;
    const savedSearch = match.search;
    return {
      id: match.id,
      listingId: listing.id,
      listingTitle: listing.title || "Anuncio disponible",
      category: listing.category,
      gradeLevel: listing.grade_level,
      condition: listing.condition,
      searchLabel: savedSearch?.query || savedSearch?.isbn_query || savedSearch?.category || savedSearch?.grade_level || "Búsqueda guardada",
      matchedAt: match.matched_at,
    };
  });

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

        <section className="mb-6 rounded-3xl border bg-background p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary"><Bell className="h-4 w-4" /> Avisos encontrados</p>
              <h2 className="mt-1 text-xl font-semibold">Novedades para tus búsquedas</h2>
              <p className="mt-1 text-sm text-muted-foreground">Anuncios disponibles que coinciden con avisos que guardaste.</p>
            </div>
            {matchItems.length > 0 ? <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{matchItems.length}</span> : null}
          </div>

          <SavedSearchMatchesList initialMatches={matchItems} />
        </section>

        <SavedSearchesList initialSearches={visibleSavedSearches as any} />
      </div>
    </div>
  );
}
