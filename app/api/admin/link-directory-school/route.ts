import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The superadmin explicitly selects an official 8-digit directory code.
// This action NEVER creates a school, invites an AMPA or switches is_active.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[0-9]{8}$/;
type LinkPayload = {
  schoolId?: string;
  officialCode?: string;
  mode?: "preview" | "link";
  confirmedSchoolName?: string;
  confirmedDirectoryName?: string;
  confirm?: boolean;
};
const normalize = (input: string | null | undefined) =>
  (input || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  }
  const { data: roles, error: roleError } = await supabase.from("user_roles")
    .select("role").eq("user_id", user.id).eq("role", "super_admin").limit(1);
  if (roleError || !roles?.length) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403, headers: noStore });
  }

  const body = await request.json().catch(() => null) as LinkPayload | null;
  const schoolId = body?.schoolId?.trim() || "";
  const officialCode = body?.officialCode?.trim() || "";
  if (!UUID.test(schoolId) || !CODE.test(officialCode) ||
      !["preview", "link"].includes(body?.mode || "")) {
    return NextResponse.json({ error: "Código y centro inválidos." }, { status: 400, headers: noStore });
  }
  try {
    const admin = createAdminClient();
    const [{ data: school, error: schoolError },
           { data: directory, error: directoryError },
           { data: approved, error: requestError },
           { data: otherLink, error: linkedError }] = await Promise.all([
      admin.from("schools").select("id,name,city,postal_code,is_active,is_test")
        .eq("id", schoolId).maybeSingle(),
      admin.from("school_directory")
        .select("official_code,name,municipality,postal_code,linked_school_id")
        .eq("official_code", officialCode).maybeSingle(),
      admin.from("school_registration_requests").select("id")
        .eq("approved_school_id", schoolId).eq("status", "approved")
        .limit(1).maybeSingle(),
      admin.from("school_directory").select("official_code")
        .eq("linked_school_id", schoolId).neq("official_code", officialCode)
        .limit(1).maybeSingle(),
    ]);
    if (schoolError || directoryError || requestError || linkedError) {
      throw new Error("school_directory_verification_failed");
    }
    if (!school || !directory) {
      return NextResponse.json({ error: "El centro o código oficial no existe." },
        { status: 404, headers: noStore });
    }
    const linked = directory.linked_school_id === schoolId;
    const checks = {
      realActiveCommunity: school.is_active === true && school.is_test === false,
      ampaApproved: Boolean(approved?.id),
      matchingPostalCode: Boolean(school.postal_code && directory.postal_code &&
        school.postal_code === directory.postal_code),
      matchingMunicipality: Boolean(school.city && directory.municipality &&
        normalize(school.city) === normalize(directory.municipality)),
      codeNotClaimedElsewhere: !directory.linked_school_id ||
        directory.linked_school_id === schoolId,
      communityNotLinkedElsewhere: !otherLink,
    };
    const ready = Object.values(checks).every(Boolean);
    const preview = {
      ready, linked,
      checks,
      school: { id: school.id, name: school.name, city: school.city,
        postalCode: school.postal_code },
      directory: { officialCode: directory.official_code,
        name: directory.name, municipality: directory.municipality,
        postalCode: directory.postal_code },
    };
    if (body?.mode === "preview") {
      return NextResponse.json(preview, { headers: noStore });
    }
    if (!ready || body?.confirm !== true ||
        body.confirmedSchoolName !== school.name ||
        body.confirmedDirectoryName !== directory.name) {
      return NextResponse.json({ error: "Vinculación no verificada; vuelve a comprobar los datos." },
        { status: 409, headers: noStore });
    }
    if (!linked) {
      // UNIQUE(linked_school_id) is enforced by PostgreSQL. Also use an
      // optimistic guard on the directory row against concurrent admins.
      const { data: updated, error: updateError } = await admin.from("school_directory")
        .update({ linked_school_id: schoolId })
        .eq("official_code", officialCode)
        .is("linked_school_id", null)
        .select("official_code,linked_school_id").maybeSingle();
      if (updateError || !updated || updated.linked_school_id !== schoolId) {
        return NextResponse.json({ error: "El enlace ha cambiado; vuelve a verificar." },
          { status: 409, headers: noStore });
      }
    }
    return NextResponse.json({ ok: true, linked: true,
      message: "El colegio oficial y la comunidad están vinculados sin alterar los anuncios." },
      { headers: noStore });
  } catch (error) {
    console.error("Error verificando código oficial:", error);
    return NextResponse.json({ error: "No se pudo verificar el centro." },
      { status: 503, headers: noStore });
  }
}
