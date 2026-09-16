import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { savedSearchMatchesListing } from "@/lib/marketplace/saved-search-matching";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    if (!listingId) return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });

    const admin = createAdminClient();
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, seller_id, title, description, isbn, category, grade_level, listing_type, type, condition, school_id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) throw listingError;
    if (!listing) return NextResponse.json({ error: "No se encontró el anuncio." }, { status: 404 });
    if (listing.seller_id !== user.id) return NextResponse.json({ error: "No puedes procesar este anuncio." }, { status: 403 });
    if (listing.status !== "available") return NextResponse.json({ ok: true, skipped: true, reason: "listing_not_available" });

    const { data: savedSearches, error: searchesError } = await admin
      .from("saved_searches")
      .select("id, user_id, query, isbn_query, category, grade_level, listing_type, condition, only_my_community, school_id")
      .eq("notifications_enabled", true)
      .neq("user_id", user.id);

    if (searchesError) throw searchesError;

    const matches = (savedSearches || [])
      .filter((search) => savedSearchMatchesListing(search, listing))
      .map((search) => ({ saved_search_id: search.id, listing_id: listing.id, user_id: search.user_id }));

    if (matches.length === 0) return NextResponse.json({ ok: true, matched: 0 });

    const { error: insertError } = await admin
      .from("saved_search_matches")
      .upsert(matches, { onConflict: "saved_search_id,listing_id", ignoreDuplicates: true });

    if (insertError) throw insertError;
    return NextResponse.json({ ok: true, matched: matches.length });
  } catch (error: any) {
    console.error("No se pudieron generar los matches de búsquedas guardadas", error);
    return NextResponse.json({ error: error?.message || "No se pudieron generar los avisos." }, { status: 500 });
  }
}
