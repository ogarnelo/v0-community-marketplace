import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { savedSearchMatchesListing } from "@/lib/marketplace/saved-search-matching";
import { resolveCommunitySchoolsForUsers } from "@/lib/marketplace/community-school-context";
import { isCurrentCourseAlert } from "@/lib/demand/course-alert-eligibility";
import { sendSavedSearchMatchEmail } from "@/lib/emails/saved-search-match-email";
import { createNotificationOnce } from "@/lib/notifications";
import { sendTransactionalEmailOnce } from "@/lib/emails/delivery-idempotency";
import { recordNeedResult } from "@/lib/demand/need-attribution";

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
      .select("id, user_id, query, isbn_query, category, grade_level, listing_type, condition, only_my_community, school_id, demand_request_id, intent_source")
      .eq("notifications_enabled", true)
      .neq("user_id", user.id);

    if (searchesError) throw searchesError;

    // Validate educational searches against CURRENT owner/student/need/demand data.
    // Never notify a parent about a need tied to an inactive or changed student.
    const educationalSearches = (savedSearches || []).filter((search) => search.intent_source === "course_need");
    const demandIds = Array.from(new Set(educationalSearches.map((search) => search.demand_request_id).filter((id): id is string => Boolean(id))));
    const validEducationalSearchIds = new Set<string>();

    if (demandIds.length > 0) {
      const [{ data: demands, error: demandsError }, { data: needs, error: needsError }] = await Promise.all([
        admin.from("demand_requests")
          .select("id,user_id,source,status,school_id,grade_level")
          .in("id", demandIds),
        admin.from("course_needs")
          .select("owner_user_id,student_id,demand_request_id,status,academic_year")
          .in("demand_request_id", demandIds),
      ]);
      if (demandsError) throw demandsError;
      if (needsError) throw needsError;
      const studentIds = Array.from(new Set((needs || []).map((need) => need.student_id)));
      const { data: students, error: studentError } = studentIds.length > 0
        ? await admin.from("account_students")
          .select("id,owner_user_id,active,school_id,grade_level,academic_year")
          .in("id", studentIds)
        : { data: [], error: null };
      if (studentError) throw studentError;

      const demandById = new Map((demands || []).map((demand) => [demand.id, demand]));
      const needByDemandId = new Map((needs || []).map((need) => [need.demand_request_id, need]));
      const studentById = new Map((students || []).map((student) => [student.id, student]));

      for (const search of educationalSearches) {
        const demand = search.demand_request_id ? demandById.get(search.demand_request_id) : undefined;
        const need = demand ? needByDemandId.get(demand.id) : undefined;
        const student = need ? studentById.get(need.student_id) : undefined;
        if (isCurrentCourseAlert(search, demand, need, student)) validEducationalSearchIds.add(search.id);
      }
    }

    const eligibleSavedSearches = (savedSearches || []).filter((search) =>
      search.intent_source !== "course_need" || validEducationalSearchIds.has(search.id)
    );

    // General saved searches with "Solo mi comunidad" follow the CURRENT
    // linked schools (not a stale school_id captured when the alert was saved).
    const communityUserIds = Array.from(new Set(eligibleSavedSearches
      .filter((search) => search.only_my_community)
      .map((search) => search.user_id)));
    let communitySchoolIds = new Map<string, string[]>();
    if (communityUserIds.length > 0) {
      const [{ data: familyStudents, error: familyStudentsError },
        { data: adminRoles, error: adminRolesError },
        { data: userProfiles, error: userProfilesError }] = await Promise.all([
          admin.from("account_students")
            .select("owner_user_id,school_id")
            .in("owner_user_id", communityUserIds)
            .eq("active", true),
          admin.from("user_roles")
            .select("user_id,school_id,role")
            .in("user_id", communityUserIds)
            .eq("role", "school_admin"),
          admin.from("profiles")
            .select("id,school_id")
            .in("id", communityUserIds),
        ]);
      if (familyStudentsError || adminRolesError || userProfilesError) {
        throw familyStudentsError || adminRolesError || userProfilesError;
      }
      communitySchoolIds = resolveCommunitySchoolsForUsers({
        userIds: communityUserIds,
        students: familyStudents || [],
        roles: adminRoles || [],
        profiles: userProfiles || [],
      });
    }
    const scopedSearches = eligibleSavedSearches.map((search) => (
      search.only_my_community
        ? { ...search, school_ids: communitySchoolIds.get(search.user_id) || [] }
        : search
    ));

    const matches = scopedSearches
      .filter((search) => savedSearchMatchesListing(search, listing))
      .map((search) => ({ saved_search_id: search.id, listing_id: listing.id, user_id: search.user_id }));

    if (matches.length === 0) return NextResponse.json({ ok: true, matched: 0, notified: 0, emailed: 0, supplyGenerated });

    const { error: insertError } = await admin
      .from("saved_search_matches")
      .upsert(matches, { onConflict: "saved_search_id,listing_id", ignoreDuplicates: true });

    if (insertError) throw insertError;

    for (const search of eligibleSavedSearches) {
      if (!search.demand_request_id) continue;
      if (!matches.some((match) => match.saved_search_id === search.id)) continue;
      try {
        await recordNeedResult(admin, {
          needId: search.demand_request_id,
          listingId: listing.id,
        });
      } catch (needError) {
        console.error("No se pudo registrar el primer resultado de la necesidad", needError);
      }
    }

    const { data: pendingNotifications, error: notificationQueryError } = await admin
      .from("saved_search_matches")
      .select("id, user_id")
      .eq("listing_id", listing.id)
      .in("saved_search_id", matches.map((match) => match.saved_search_id))
      .is("notified_at", null);

    if (notificationQueryError) throw notificationQueryError;

    let notified = 0;
    for (const match of pendingNotifications || []) {
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
        if (!delivery.sent) continue;

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
