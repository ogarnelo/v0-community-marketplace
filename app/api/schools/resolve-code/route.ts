import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code =
    typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!code || code.length > 64) {
    return NextResponse.json({ error: "Código no válido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: accessCode, error: codeError } = await admin
    .from("school_access_codes")
    .select("school_id")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (codeError || !accessCode?.school_id) {
    return NextResponse.json(
      { error: "Ese código de centro no existe o ya no está activo." },
      { status: 404 }
    );
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, name, city, postal_code")
    .eq("id", accessCode.school_id)
    .eq("is_active", true)
    .maybeSingle();

  if (schoolError || !school) {
    return NextResponse.json(
      { error: "Ese código de centro no existe o ya no está activo." },
      { status: 404 }
    );
  }

  return NextResponse.json({ school });
}
