import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractIsbnFromText, normalizeIsbn } from "@/lib/books/isbn";
import { hasKnownPostalCode } from "@/lib/marketplace/postal-distance";
import { hasMeaningfulSearchTerms } from "@/lib/marketplace/saved-search-matching";
import { resolveUniqueSchoolAdminSchoolId } from "@/lib/marketplace/unique-school-admin-context";
import { resolveSingleCommunityAlertContext } from "@/lib/marketplace/multischool-alert-context";

function cleanText(value: unknown, maxLength = 160) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const query = cleanText(body.query);
    const rawIsbnQuery = cleanText(body.isbnQuery, 40);
    const explicitIsbn = rawIsbnQuery ? normalizeIsbn(rawIsbnQuery)?.canonicalIsbn || null : null;
    const inferredIsbn =
      explicitIsbn ||
      extractIsbnFromText([query, cleanText(body.needDetails, 500)].filter(Boolean).join(" "))?.canonicalIsbn ||
      null;
    const isbnQuery = inferredIsbn || rawIsbnQuery;
    const category = cleanText(body.category, 80);
    const gradeLevel = cleanText(body.gradeLevel, 80);
    const listingType = cleanText(body.listingType, 40);
    const condition = cleanText(body.condition, 40);
    const sourcePath = cleanText(body.sourcePath, 120) || "/marketplace";
    const needDetails = cleanText(body.needDetails, 500);
    const intentSource = cleanText(body.intentSource, 40) || "saved_search";
    const resultsCount = cleanNumber(body.resultsCount);
    // Saved radius must constrain future matching, not merely the initial UI.
    const rawRadius = body.radiusKm;
    const radiusKm = body.onlyMyCommunity || rawRadius === null || rawRadius === undefined
      ? null : rawRadius;
    if (radiusKm !== null &&
        (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 200)) {
      return NextResponse.json({ ok: false, error: "invalid_radius" }, { status: 400 });
    }
    // A described zero-result need is valid even with no text field selected.
    // Persist it as the matching query to prevent broad unrelated alerts.
    // If the parent describes a precise need, use those meaningful terms
    // even when a category/grade is also selected. Otherwise an alert for
    // "polo azul talla 12" would notify on ANY item in "Uniformes".
    const matchingQuery =
      (hasMeaningfulSearchTerms(query) ? query : null) ||
      (!isbnQuery && hasMeaningfulSearchTerms(needDetails)
        ? needDetails?.slice(0, 160) || null : null);
    const savedSearchName =
      needDetails ||
      query ||
      isbnQuery ||
      category ||
      gradeLevel ||
      "Búsqueda guardada";

    if (!matchingQuery && !isbnQuery && !category && !gradeLevel) {
      return NextResponse.json({ ok: false, error: "search_intent_required" }, { status: 400 });
    }

    const [
      { data: profile },
      { data: schoolAdminRole },
      { data: primaryStudentContext },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("school_id,postal_code")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("school_id")
        .eq("user_id", user.id)
        .eq("role", "school_admin")
        .not("school_id", "is", null)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("account_students")
        .select("school_id,directory_school_code,is_primary,sort_order,created_at")
        .eq("owner_user_id", user.id)
        .eq("active", true)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (radiusKm !== null && !hasKnownPostalCode(profile?.postal_code)) {
      return NextResponse.json({ ok: false, error: "postal_code_required" }, { status: 422 });
    }

    // Match the exact school context shown on /marketplace:
    // a selected directory school takes precedence over stale profile.school_id.
    let familyScopeMode: "single" | "active_family" = "single";
    let directorySchoolCode = schoolAdminRole?.school_id
      ? null : primaryStudentContext?.directory_school_code?.trim() || null;
    let schoolId =
      schoolAdminRole?.school_id?.trim() ||
      (primaryStudentContext
        ? primaryStudentContext.school_id?.trim() || null
        : profile?.school_id?.trim() || null);


    // The community feed can show a union of several current family schools,
    // but legacy saved_searches persists only ONE. Never save a misleading
    // first-school alert in multi-school mode; clients must not infer broad
    // notifications from a boolean "onlyMyCommunity".
    if (body.onlyMyCommunity &&
        process.env.WETUDY_MULTISCHOOL_LISTINGS_ENABLED === "true") {
      const [rolesResult, studentsResult] = await Promise.all([
        supabase.from("user_roles").select("school_id")
          .eq("user_id", user.id).eq("role", "school_admin").limit(2),
        supabase.from("account_students")
          .select("school_id,directory_school_code")
          .eq("owner_user_id", user.id).eq("active", true).limit(101),
      ]);
      if (rolesResult.error || studentsResult.error) {
        return NextResponse.json({ ok: false, error: "school_context_unavailable" },
          { status: 503, headers: { "Cache-Control": "private, no-store" } });
      }
      let managedId: string | null;
      try {
        managedId = resolveUniqueSchoolAdminSchoolId(rolesResult.data);
      } catch {
        return NextResponse.json({ ok: false, error: "school_context_unavailable" },
          { status: 503, headers: { "Cache-Control": "private, no-store" } });
      }
      if (managedId) {
        schoolId = managedId;
        directorySchoolCode = null;
      } else {
        try {
          const active = studentsResult.data || [];
          const single = resolveSingleCommunityAlertContext(
            active, active.length ? null : {
              school_id: profile?.school_id || null,
              directory_school_code: null,
            }
          );
          if (single.ambiguous) {
            // A separate flag prevents an upgrade before the reviewed
            // community_scope_mode column exists and delivery has been tested.
            if (process.env.WETUDY_MULTISCHOOL_ALERT_SCOPE_ENABLED !== "true") {
              return NextResponse.json({
                ok: false, error: "multi_school_saved_search_not_supported",
              }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
            }
            familyScopeMode = "active_family";
            schoolId = null;
            directorySchoolCode = null;
          } else {
            schoolId = single.schoolId;
            directorySchoolCode = single.directoryCode;
          }
        } catch {
          return NextResponse.json({ ok: false, error: "school_context_unavailable" },
            { status: 503, headers: { "Cache-Control": "private, no-store" } });
        }
      }
    }

    if (body.onlyMyCommunity && !directorySchoolCode && !schoolId &&
        familyScopeMode !== "active_family") {
      return NextResponse.json({ ok: false, error: "school_context_required" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: user.id,
        name: savedSearchName,
        query: matchingQuery,
        isbn_query: isbnQuery,
        radius_km: radiusKm,
        category,
        grade_level: gradeLevel,
        listing_type: listingType,
        condition,
        only_my_community: Boolean(body.onlyMyCommunity),
        school_id: schoolId,
        directory_school_code: directorySchoolCode,
        // Do not refer to the new DB column at all while its feature is OFF.
        ...(familyScopeMode === "active_family"
          ? { community_scope_mode: "active_family" as const } : {}),
        results_count: resultsCount,
        source_path: sourcePath,
        need_details: needDetails,
        intent_source: intentSource,
        notifications_enabled: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error guardando búsqueda:", error);
      return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
    }

    let demandRequestId: string | null = null;
    if (resultsCount === 0 && intentSource === "zero_results_prompt") {
      try {
        const admin = createAdminClient();
        const canonicalIsbn = inferredIsbn;
        const { data: demandRequest, error: demandError } = await admin
          .from("demand_requests")
          .insert({
            user_id: user.id,
            title: savedSearchName.slice(0, 160),
            normalized_query: matchingQuery?.toLowerCase() || needDetails?.toLowerCase().slice(0, 160) || null,
            category,
            grade_level: gradeLevel,
            isbn: canonicalIsbn,
            school_id: schoolId,
            status: "open",
            source: "saved_search",
            metadata: {
              saved_search_id: data.id,
              intent_source: intentSource,
              listing_type: listingType,
              condition,
              only_my_community: Boolean(body.onlyMyCommunity),
              directory_school_code: directorySchoolCode,
              radius_km: radiusKm,
            },
          })
          .select("id")
          .single();
        if (demandError) throw demandError;

        demandRequestId = demandRequest.id;
        const { error: linkError } = await admin
          .from("saved_searches")
          .update({ demand_request_id: demandRequest.id })
          .eq("id", data.id)
          .eq("user_id", user.id);
        if (linkError) throw linkError;
      } catch (demandError) {
        console.error("La búsqueda se guardó, pero no se pudo crear la identidad de necesidad:", demandError);
      }
    }

    return NextResponse.json({ ok: true, savedSearchId: data.id, demandRequestId });
  } catch (error) {
    console.error("Error en saved-searches:", error);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
