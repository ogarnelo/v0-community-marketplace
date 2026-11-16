import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const guest = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson({ error: guest ? "No autenticado." : "No se pudo comprobar tu sesión." }, guest ? 401 : 503);
    }
    const user = data?.user;
    if (!user) return privateJson({ error: "No autenticado." }, 401);

    const body = await request.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code || code.length > 64) return privateJson({ error: "Código no válido." }, 400);

    // Service-role access is permitted only after Auth has succeeded without error.
    const admin = createAdminClient();
    const { data: accessCode, error: codeError } = await admin
      .from("school_access_codes")
      .select("school_id")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();
    if (codeError) return privateJson({ error: "No se pudo consultar el código." }, 503);
    if (!accessCode?.school_id) return privateJson({ error: "Ese código de centro no existe o ya no está activo." }, 404);

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name, city, postal_code")
      .eq("id", accessCode.school_id)
      .eq("is_active", true)
      .maybeSingle();
    if (schoolError) return privateJson({ error: "No se pudo consultar el centro." }, 503);
    if (!school) return privateJson({ error: "Ese código de centro no existe o ya no está activo." }, 404);
    return privateJson({ school });
  } catch {
    return privateJson({ error: "No se pudo completar la operación." }, 503);
  }
}
