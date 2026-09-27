import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyCourseBetaAccess } from "@/lib/my-course/beta-access";

function cleanText(value: unknown, maxLength = 80) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
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
    const label = cleanText(body.label) || "Hijo/a";
    const schoolId = cleanText(body.schoolId, 64);
    const gradeLevel = cleanText(body.gradeLevel);
    const academicYear = cleanText(body.academicYear, 16);

    if (!schoolId || !gradeLevel || !/^\d{4}\/\d{2}$/.test(academicYear)) {
      return NextResponse.json({ ok: false, error: "invalid_learner" }, { status: 400 });
    }

    const [{ data: profile }, { data: school }] = await Promise.all([
      supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle(),
      supabase.from("schools").select("id").eq("id", schoolId).eq("is_active", true).maybeSingle(),
    ]);

    if (!school?.id) {
      return NextResponse.json({ ok: false, error: "school_not_found" }, { status: 404 });
    }

    const access = await getMyCourseBetaAccess({
      userId: user.id,
      linkedSchoolIds: [profile?.school_id],
    });

    if (!access) {
      return NextResponse.json({ ok: false, error: "beta_not_enabled" }, { status: 404 });
    }

    if (access === "school" && profile?.school_id !== schoolId) {
      return NextResponse.json({ ok: false, error: "school_not_authorized" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("family_learners")
      .insert({
        parent_user_id: user.id,
        school_id: schoolId,
        label,
        grade_level: gradeLevel,
        academic_year: academicYear,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, learnerId: data.id });
  } catch (error) {
    console.error("No se pudo crear el perfil de curso beta:", error);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
