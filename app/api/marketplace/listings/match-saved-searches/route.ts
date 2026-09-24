import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { savedSearchMatchesListing } from "@/lib/marketplace/saved-search-matching";
import { sendSavedSearchMatchEmail } from "@/lib/emails/saved-search-match-email";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const opportunityKey = typeof body?.opportunityKey === "string" ? body.opportunityKey.trim() : "";
    if (!listingId) return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });

    const admin = createAdminClient();
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, seller_id, title, description, isbn, author, publisher, format, language, subject, specific_type, size_label, brand, model, season, category, grade_level, listing_type, type, condition, school_id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) throw listingError;
    if (!listing) return NextResponse.json({ error: "No se encontró el anuncio." }, { status: 404 });
    if (listing.seller_id !== user.id) return NextResponse.json({ error: "No puedes procesar este anuncio." }, { status: 403 });
    if (listing.status !== "available") return NextResponse.json({ ok: true, skipped: true, reason: "listing_not_available" });

    let supplyGenerated = false;
    if (opportunityKey) {
      const { data: activationAction } = await admin
        .from("demand_opportunity_actions")
        .select("id,response,responded_at")
        .eq("opportunity_key", opportunityKey)
        .eq("target_user_id", user.id)
        .eq("action_type", "seller_contacted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activationAction) {
        const now = new Date().toISOString();
        const { error: actionError } = await admin
          .from("demand_opportunity_actions")
          .update({
            resulting_listing_id: listing.id,
            responded_at: activationAction.responded_at || now,
            response: activationAction.response || "have_one",
          })
          .eq("id", activationAction.id);
        if (actionError) throw actionError;

        const { error: campaignError } = await admin
          .from("demand_campaigns")
          .update({ status: "supply_generated", updated_at: now })
          .eq("opportunity_key", opportunityKey);
        if (campaignError) throw campaignError;
        supplyGenerated = true;
      }
    }

    const { data: savedSearches, error: searchesError } = await admin
      .from("saved_searches")
      .select("id, user_id, query, isbn_query, category, grade_level, listing_type, condition, only_my_community, school_id")
      .eq("notifications_enabled", true)
      .neq("user_id", user.id);

    if (searchesError) throw searchesError;

    const matches = (savedSearches || [])
      .filter((search) => savedSearchMatchesListing(search, listing))
      .map((search) => ({ saved_search_id: search.id, listing_id: listing.id, user_id: search.user_id }));

    if (matches.length === 0) return NextResponse.json({ ok: true, matched: 0, notified: 0, emailed: 0, supplyGenerated });

    const { error: insertError } = await admin
      .from("saved_search_matches")
      .upsert(matches, { onConflict: "saved_search_id,listing_id", ignoreDuplicates: true });

    if (insertError) throw insertError;

    const { data: pendingNotifications, error: notificationQueryError } = await admin
      .from("saved_search_matches")
      .select("id, user_id")
      .eq("listing_id", listing.id)
      .in("saved_search_id", matches.map((match) => match.saved_search_id))
      .is("notified_at", null);

    if (notificationQueryError) throw notificationQueryError;

    let notified = 0;
    for (const match of pendingNotifications || []) {
      const { data: existingNotification } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", match.user_id)
        .eq("kind", "saved_search_match")
        .contains("metadata", { saved_search_match_id: match.id })
        .limit(1)
        .maybeSingle();

      if (!existingNotification) {
        const result = await createNotification(admin, {
          user_id: match.user_id,
          kind: "saved_search_match",
          title: "Ha aparecido algo que estabas buscando",
          body: listing.title,
          href: `/marketplace/listing/${listing.id}`,
          metadata: {
            saved_search_match_id: match.id,
            listing_id: listing.id,
          },
        });
        if (result.error) throw result.error;
      }

      const { error: markNotificationError } = await admin
        .from("saved_search_matches")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", match.id)
        .is("notified_at", null);
      if (markNotificationError) throw markNotificationError;
      notified += 1;
    }

    const { data: pendingMatches, error: pendingError } = await admin
      .from("saved_search_matches")
      .select("id, user_id")
      .eq("listing_id", listing.id)
      .in("saved_search_id", matches.map((match) => match.saved_search_id))
      .is("emailed_at", null);

    if (pendingError) throw pendingError;

    let emailed = 0;
    for (const match of pendingMatches || []) {
      try {
        const { data: recipient, error: recipientError } = await admin.auth.admin.getUserById(match.user_id);
        if (recipientError) throw recipientError;
        if (!recipient.user?.email) continue;

        const result = await sendSavedSearchMatchEmail({
          to: recipient.user.email,
          listingId: listing.id,
          listingTitle: listing.title,
          idempotencyKey: `saved-search-match/${match.id}`,
        });
        if ("skipped" in result && result.skipped) continue;

        const { error: markError } = await admin
          .from("saved_search_matches")
          .update({ emailed_at: new Date().toISOString() })
          .eq("id", match.id)
          .is("emailed_at", null);
        if (markError) throw markError;
        emailed += 1;
      } catch (emailError) {
        console.error("No se pudo enviar un aviso de búsqueda guardada", emailError);
      }
    }

    return NextResponse.json({ ok: true, matched: matches.length, notified, emailed, supplyGenerated });
  } catch (error: any) {
    console.error("No se pudieron generar los matches de búsquedas guardadas", error);
    return NextResponse.json({ error: error?.message || "No se pudieron generar los avisos." }, { status: 500 });
  }
}
