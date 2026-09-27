import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeIsbn } from "@/lib/books/isbn";
import { canUseMyCourseBeta } from "@/lib/my-course/beta-access";

function cleanText(value: unknown, maxLength = 160) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => "\\" + character);
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
    const learnerId = cleanText(body.learnerId, 64);
    const title = cleanText(body.title);
    const category = cleanText(body.category, 80) || null;
    const rawIsbn = cleanText(body.isbn, 40);
    const isbn = rawIsbn ? normalizeIsbn(rawIsbn)?.canonicalIsbn || null : null;

    if (!learnerId || (!title && !isbn)) {
      return NextResponse.json({ ok: false, error: "need_required" }, { status: 400 });
    }

    const { data: learner, error: learnerError } = await supabase
      .from("family_learners")
      .select("id, school_id, grade_level")
      .eq("id", learnerId)
      .eq("parent_user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (learnerError) throw learnerError;
    if (!learner) {
      return NextResponse.json({ ok: false, error: "learner_not_found" }, { status: 404 });
    }

    const allowed = await canUseMyCourseBeta({
      userId: user.id,
      schoolIds: [learner.school_id],
    });

    if (!allowed) {
      return NextResponse.json({ ok: false, error: "beta_not_enabled" }, { status: 404 });
    }

    let listingQuery = supabase
      .from("listings")
      .select("id, title, school_id, grade_level, isbn")
      .eq("status", "available")
      .limit(20);

    if (isbn) {
      listingQuery = listingQuery.eq("isbn", isbn);
    } else {
      listingQuery = listingQuery.ilike("title", "%" + escapeLike(title) + "%");
    }

    const { data: candidateListings, error: listingError } = await listingQuery;
    if (listingError) throw listingError;

    const rankedListings = [...(candidateListings || [])].sort((a: any, b: any) => {
      const aSchool = a.school_id === learner.school_id ? 1 : 0;
      const bSchool = b.school_id === learner.school_id ? 1 : 0;
      if (aSchool !== bSchool) return bSchool - aSchool;

      const aGrade = a.grade_level === learner.grade_level ? 1 : 0;
      const bGrade = b.grade_level === learner.grade_level ? 1 : 0;
      return bGrade - aGrade;
    });

    const bestMatch = rankedListings[0] || null;
    const now = new Date().toISOString();
    const needTitle = title || isbn || "Necesidad de curso";

    const { data: need, error: needError } = await supabase
      .from("demand_requests")
      .insert({
        user_id: user.id,
        learner_id: learner.id,
        title: needTitle.slice(0, 160),
        normalized_query: title ? title.toLowerCase() : null,
        category,
        grade_level: learner.grade_level,
        isbn,
        school_id: learner.school_id,
        status: bestMatch ? "matched" : "open",
        source: "my_course_beta",
        matched_listing_id: bestMatch?.id || null,
        first_result_at: bestMatch ? now : null,
        metadata: {
          experience: "my_course_beta",
        },
      })
      .select("id")
      .single();

    if (needError) throw needError;

    const { data: savedSearch, error: savedSearchError } = await supabase
      .from("saved_searches")
      .insert({
        user_id: user.id,
        name: needTitle.slice(0, 160),
        query: title || null,
        isbn_query: isbn,
        category,
        grade_level: learner.grade_level,
        only_my_community: true,
        school_id: learner.school_id,
        results_count: rankedListings.length,
        source_path: "/beta/mi-curso",
        need_details: needTitle.slice(0, 500),
        intent_source: "my_course_beta",
        notifications_enabled: true,
        demand_request_id: need.id,
      })
      .select("id")
      .single();

    if (savedSearchError) {
      console.error("La necesidad se creó pero no pudo activar el aviso automático:", savedSearchError);
    }

    return NextResponse.json({
      ok: true,
      needId: need.id,
      savedSearchId: savedSearch?.id || null,
      matchListingId: bestMatch?.id || null,
      resultsCount: rankedListings.length,
    });
  } catch (error) {
    console.error("No se pudo crear una necesidad de Mi curso:", error);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
