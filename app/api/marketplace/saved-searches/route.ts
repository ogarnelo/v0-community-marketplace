import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeIsbn } from "@/lib/books/isbn";

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
    const isbnQuery = cleanText(body.isbnQuery, 40);
    const category = cleanText(body.category, 80);
    const gradeLevel = cleanText(body.gradeLevel, 80);
    const listingType = cleanText(body.listingType, 40);
    const condition = cleanText(body.condition, 40);
    const sourcePath = cleanText(body.sourcePath, 120) || "/marketplace";
    const needDetails = cleanText(body.needDetails, 500);
    const intentSource = cleanText(body.intentSource, 40) || "saved_search";
    const resultsCount = cleanNumber(body.resultsCount);
    const savedSearchName =
      needDetails ||
      query ||
      isbnQuery ||
      category ||
      gradeLevel ||
      "Búsqueda guardada";

    if (!query && !isbnQuery && !category && !gradeLevel) {
      return NextResponse.json({ ok: false, error: "search_intent_required" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();

    const schoolId = typeof profile?.school_id === "string" && profile.school_id.trim().length > 0
      ? profile.school_id
      : null;

    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: user.id,
        name: savedSearchName,
        query,
        isbn_query: isbnQuery,
        category,
        grade_level: gradeLevel,
        listing_type: listingType,
        condition,
        only_my_community: Boolean(body.onlyMyCommunity),
        school_id: schoolId,
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
        const canonicalIsbn = isbnQuery ? normalizeIsbn(isbnQuery)?.canonicalIsbn || isbnQuery : null;
        const { data: demandRequest, error: demandError } = await admin
          .from("demand_requests")
          .insert({
            user_id: user.id,
            title: savedSearchName.slice(0, 160),
            normalized_query: query?.toLowerCase() || needDetails?.toLowerCase().slice(0, 160) || null,
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
              radius_km: typeof body.radiusKm === "number" ? body.radiusKm : null,
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
