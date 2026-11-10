import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { savedSearchMatchesListing } from "@/lib/marketplace/saved-search-matching";
import { approximateDistanceKm } from "@/lib/marketplace/postal-distance";
import { loadAllSortedPages, batchAlertItems } from "@/lib/marketplace/saved-search-batches.mjs";
import { selectDeliveryPage, summarizeDeliveryProgress } from "@/lib/marketplace/alert-delivery-progress.mjs";
import { loadPendingDeliveryRows } from "@/lib/marketplace/alert-pending-page.mjs";
import { sendSavedSearchMatchEmail } from "@/lib/emails/saved-search-match-email";
import { createNotificationOnce } from "@/lib/notifications";
import { sendTransactionalEmailOnce } from "@/lib/emails/delivery-idempotency";
import { recordNeedResult } from "@/lib/demand/need-attribution";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    // The outbox worker can reprocess a listing only when explicitly enabled
    // AND signed with the server's CRON_SECRET. No authorization from the
    // listing ID or caller-supplied school/email information is trusted.
    const cronSecret = process.env.CRON_SECRET;
    const isOutboxWorker = process.env.WETUDY_ALERT_OUTBOX_ENABLED === "true" &&
      Boolean(cronSecret) &&
      request.headers.get("authorization") === `Bearer ${cronSecret}` &&
      request.headers.get("x-wetudy-alert-outbox") === "1";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !isOutboxWorker) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const opportunityKey = typeof body?.opportunityKey === "string" ? body.opportunityKey.trim() : "";
    if (!listingId) return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });

    const admin = createAdminClient();
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, seller_id, user_id, is_demo, title, description, isbn, author, publisher, format, language, subject, specific_type, size_label, brand, model, season, category, grade_level, listing_type, type, condition, school_id, directory_school_code, postal_code, status")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) throw listingError;
    if (!listing) return NextResponse.json({ error: "No se encontró el anuncio." }, { status: 404 });
    if (!isOutboxWorker) {
      if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
      if (listing.seller_id !== user.id && listing.user_id !== user.id) {
        return NextResponse.json({ error: "No puedes procesar este anuncio." }, { status: 403 });
      }
    }
    const listingOwnerId = listing.seller_id || listing.user_id;
    if (!listingOwnerId) return NextResponse.json({ error: "Anuncio sin vendedor." }, { status: 409 });
    // Internal reconciliation excludes DEMO content, even if someone set the
    // DEMO flag after an outbox entry was initially created.
    if (isOutboxWorker && listing.is_demo === true) {
      return NextResponse.json({ ok: true, skipped: true, reason: "demo_listing" });
    }
    if (listing.status !== "available") return NextResponse.json({ ok: true, skipped: true, reason: "listing_not_available" });

    let supplyGenerated = false;
    if (!isOutboxWorker && opportunityKey) {
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

    // Supabase's configured maximum row count must never silently truncate
    // the audience. Stable UUID keyset pages also avoid large OFFSET scans.
    const savedSearches = await loadAllSortedPages(async (afterId, limit) => {
      let query = admin.from("saved_searches")
        .select("id, user_id, query, isbn_query, category, grade_level, listing_type, condition, only_my_community, school_id, directory_school_code, radius_km, demand_request_id")
        .eq("notifications_enabled", true)
        .neq("user_id", listingOwnerId)
        .order("id", { ascending: true })
        .limit(limit);
      if (afterId) query = query.gt("id", afterId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });

    // Cheap content-only matching runs before any directory or postcode
    // lookup. This avoids fetching irrelevant school links and location
    // profiles for saved searches that cannot match the new product.
    const contentCandidates = (savedSearches || []).filter((search) =>
      savedSearchMatchesListing({
        ...search, only_my_community: false, radius_km: null,
      }, listing));

    // Resolve directory↔operational school links once per publishing event.
    // Database references are authoritative: no school code arrives from the
    // browser. Directory codes without an explicit link cannot be matched
    // against arbitrary operational schools.
    const directoryCodes = [...new Set([
      listing.directory_school_code,
      ...contentCandidates
        .filter((search) => search.only_my_community)
        .map((search) => search.directory_school_code),
    ].filter((code): code is string => typeof code === "string" && code.length > 0))];
    const directoryLinks = new Map<string, string | null>();
    for (let start = 0; start < directoryCodes.length; start += 150) {
      const { data: directoryRows, error: directoryError } = await admin
        .from("school_directory")
        .select("official_code,linked_school_id")
        .in("official_code", directoryCodes.slice(start, start + 150));
      if (directoryError) throw directoryError;
      for (const school of directoryRows || []) {
        directoryLinks.set(school.official_code, school.linked_school_id || null);
      }
    }
    const schoolLinksFor = (search: { directory_school_code?: string | null }) => ({
      savedDirectoryLinkedSchoolId:
        directoryLinks.get(search.directory_school_code || "") || null,
      listingDirectoryLinkedSchoolId:
        directoryLinks.get(listing.directory_school_code || "") || null,
    });

    // Only inspect postcode profiles for geographically bounded searches
    // whose content and other filters already match the new listing.
    const radiusCandidates = contentCandidates.filter((search) =>
      search.radius_km !== null && search.radius_km !== undefined &&
      savedSearchMatchesListing({ ...search, radius_km: null }, listing,
        undefined, schoolLinksFor(search)));
    const candidateUserIds = [...new Set(radiusCandidates.map((search) => search.user_id))];
    const viewerPostcodes = new Map<string, string | null>();
    if (candidateUserIds.length) {
      // Keep .in() requests bounded to avoid large PostgREST query strings.
      for (let start = 0; start < candidateUserIds.length; start += 150) {
        const { data: profiles, error: profilesError } = await admin
          .from("profiles").select("id,postal_code")
          .in("id", candidateUserIds.slice(start, start + 150));
        if (profilesError) throw profilesError;
        for (const profile of profiles || []) {
          viewerPostcodes.set(profile.id, profile.postal_code || null);
        }
      }
    }

    // A listing's own published postcode takes precedence over a seller
    // who may have subsequently moved. Older listings may need fallback.
    let listingPostalCode: string | null = listing.postal_code || null;
    if (candidateUserIds.length && !listingPostalCode) {
      const { data: sellerProfile, error: sellerError } = await admin
        .from("profiles").select("postal_code")
        .eq("id", listingOwnerId).maybeSingle();
      if (sellerError) throw sellerError;
      listingPostalCode = sellerProfile?.postal_code || null;
    }

    const matches = contentCandidates
      .filter((search) => savedSearchMatchesListing(
        search, listing,
        search.radius_km === null || search.radius_km === undefined
          ? undefined
          : approximateDistanceKm(viewerPostcodes.get(search.user_id), listingPostalCode),
        schoolLinksFor(search)
      ))
      .map((search) => ({ saved_search_id: search.id, listing_id: listing.id, user_id: search.user_id }));

    if (matches.length === 0) return NextResponse.json({ ok: true, complete: true, matched: 0, notified: 0, emailed: 0, supplyGenerated });

    // Avoid oversized writes when a popular listing matches many families.
    for (const batch of batchAlertItems(matches)) {
      const { error: insertError } = await admin
        .from("saved_search_matches")
        .upsert(batch, { onConflict: "saved_search_id,listing_id", ignoreDuplicates: true });
      if (insertError) throw insertError;
    }

    const matchedSearchIds = new Set(matches.map((match) => match.saved_search_id));
    for (const search of contentCandidates) {
      if (!search.demand_request_id || !matchedSearchIds.has(search.id)) continue;
      try {
        await recordNeedResult(admin, {
          needId: search.demand_request_id,
          listingId: listing.id,
        });
      } catch (needError) {
        console.error("No se pudo registrar el primer resultado de la necesidad", needError);
      }
    }

    // Each pending lookup has at most 150 IDs: no giant PostgREST URL and
    // no implicit response-page truncation once there are >1000 matches.
    const pendingNotifications = await loadPendingDeliveryRows(
      matches, isOutboxWorker, async (batch, limit) => {
        let query = admin.from("saved_search_matches")
          .select("id, user_id")
          .eq("listing_id", listing.id)
          .in("saved_search_id", batch.map((match) => match.saved_search_id))
          .is("notified_at", null);
        // Fetch only 12+1 when recovering; the extra row proves there is more.
        if (limit !== null) {
          query = query.order("id", { ascending: true }).limit(limit);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      });

    const notificationPage = selectDeliveryPage(pendingNotifications, isOutboxWorker);
    let notified = 0;
    for (const match of notificationPage) {
      const result = await createNotificationOnce(admin, {
        event_key: `saved-search-match/${match.id}`,
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

      const { error: markNotificationError } = await admin
        .from("saved_search_matches")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", match.id)
        .is("notified_at", null);
      if (markNotificationError) throw markNotificationError;
      notified += 1;
    }

    const pendingMatches = await loadPendingDeliveryRows(
      matches, isOutboxWorker, async (batch, limit) => {
        let query = admin.from("saved_search_matches")
          .select("id, user_id")
          .eq("listing_id", listing.id)
          .in("saved_search_id", batch.map((match) => match.saved_search_id))
          .is("emailed_at", null)
          .is("email_skipped_at", null);
        if (limit !== null) {
          query = query.order("id", { ascending: true }).limit(limit);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      });

    const emailPage = selectDeliveryPage(pendingMatches, isOutboxWorker);
    let emailed = 0;
    let emailSkipped = 0;
    let emailFailures = 0;
    for (const match of emailPage) {
      try {
        const { data: recipient, error: recipientError } = await admin.auth.admin.getUserById(match.user_id);
        if (recipientError) throw recipientError;
        if (!recipient.user?.email) {
          // A user without an email address cannot receive this alert.
          // This is a terminal skip, never a successful email delivery.
          const { error: skipError } = await admin.from("saved_search_matches")
            .update({
              email_skipped_at: new Date().toISOString(),
              email_skip_reason: "recipient_missing",
            })
            .eq("id", match.id).is("email_skipped_at", null);
          if (skipError) throw skipError;
          emailSkipped++;
          continue;
        }

        const emailEventKey = `saved-search-match/${match.id}`;
        const delivery = await sendTransactionalEmailOnce(admin, {
          eventKey: emailEventKey,
          userId: match.user_id,
          recipientEmail: recipient.user.email!,
          kind: "saved_search_match",
          send: () =>
            sendSavedSearchMatchEmail({
              to: recipient.user.email!,
              listingId: listing.id,
              listingTitle: listing.title,
              idempotencyKey: emailEventKey,
            }),
        });
        if (!delivery.sent) {
          if (delivery.reason === "suppressed") {
            const { error: skipError } = await admin.from("saved_search_matches")
              .update({
                email_skipped_at: new Date().toISOString(),
                email_skip_reason: "suppressed",
              })
              .eq("id", match.id).is("email_skipped_at", null);
            if (skipError) throw skipError;
            emailSkipped++;
          } else {
            // Missing provider configuration or a transient delivery failure
            // MUST be retried, not silently marked as a completed outbox job.
            emailFailures++;
          }
          continue;
        }

        const { error: markError } = await admin
          .from("saved_search_matches")
          .update({ emailed_at: new Date().toISOString() })
          .eq("id", match.id)
          .is("emailed_at", null);
        if (markError) throw markError;
        emailed += 1;
      } catch (emailError) {
        emailFailures++;
        // Recipient addresses and provider error bodies must not be logged.
        console.error("No se pudo enviar un aviso de búsqueda guardada",
          emailError instanceof Error ? emailError.name : "unknown");
      }
    }

    const progress = summarizeDeliveryProgress({
      isWorker: isOutboxWorker,
      pendingNotifications: pendingNotifications.length,
      notificationPage: notificationPage.length,
      pendingEmails: pendingMatches.length,
      emailPage: emailPage.length,
      emailFailures,
    });
    const deliveryResponse = {
      ok: !progress.failed,
      complete: progress.complete,
      matched: matches.length,
      notified,
      emailed,
      emailSkipped,
      emailFailures,
      supplyGenerated,
    };
    if (progress.failed) {
      // A 503 prevents the worker from settling a partially failed listing
      // as completed. Existing provider/app idempotency guards remain intact.
      return NextResponse.json({ ...deliveryResponse, error: "partial_delivery_failed" }, { status: 503 });
    }
    return NextResponse.json(deliveryResponse);
  } catch (error: any) {
    console.error("No se pudieron generar los matches de búsquedas guardadas", error);
    return NextResponse.json({ error: error?.message || "No se pudieron generar los avisos." }, { status: 500 });
  }
}
