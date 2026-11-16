import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "private, no-store" };
const VALID_CODE = /^[0-9]{8}$/;
const MAX_RESULTS = 20;

type DirectoryCentre = {
  official_code: string;
  name: string;
  municipality: string;
  province: string;
  postal_code: string;
};

function respond(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: HEADERS });
}

// This API is intentionally separate from public SEO listing and operational
// community membership. Directory records are discoverable only by signed-in,
// email-confirmed families selecting a school for their own student context.
export async function GET(request: Request) {
  let authData;
  let authError;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    authData = result.data;
    authError = result.error;
  } catch {
    console.error("school_directory_auth_client_unavailable");
    return respond({ error: "No se pudo comprobar tu sesión." }, 503);
  }

  if (authError) {
    const guest = authError.name === "AuthSessionMissingError" ||
      authError.code === "session_not_found";
    return respond(
      { error: guest ? "Inicia sesión para buscar centros." : "No se pudo comprobar tu sesión." },
      guest ? 401 : 503
    );
  }
  const user = authData?.user ?? null;
  if (!user) return respond({ error: "Inicia sesión para buscar centros." }, 401);
  if (!user?.email_confirmed_at) {
    return respond({ error: "Confirma tu cuenta para buscar centros." }, 401);
  }

  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.trim() || "";
  const query = params.get("q")?.trim() || "";

  if (code && !VALID_CODE.test(code)) {
    return respond({ error: "Código oficial no válido." }, 400);
  }
  if (!code && (query.length < 3 || query.length > 90)) {
    return respond({ centres: [] });
  }

  try {
    const admin = createAdminClient();
    if (code) {
      const { data, error } = await admin
        .from("school_directory")
        .select("official_code,name,municipality,province,postal_code")
        .eq("official_code", code)
        .maybeSingle<DirectoryCentre>();
      if (error) throw error;
      return respond({ centre: data || null });
    }

    // The search_text column contains name, municipality, postal code and
    // official identifier. AND individual terms to support natural word order.
    const terms = query.split(/\s+/).filter(Boolean).slice(0, 7);
    let builder = admin
      .from("school_directory")
      .select("official_code,name,municipality,province,postal_code");

    for (const term of terms) {
      const escaped = term.replace(/[\\%_]/g, "\\$&");
      builder = builder.ilike("search_text", `%${escaped}%`);
    }

    const { data, error } = await builder
      .order("name", { ascending: true })
      .order("official_code", { ascending: true })
      .limit(MAX_RESULTS)
      .returns<DirectoryCentre[]>();

    if (error) throw error;
    return respond({ centres: data || [], limit: MAX_RESULTS });
  } catch {
    console.error("school_directory_lookup_failed");
    return respond({ error: "No se pudo buscar el centro. Vuelve a intentarlo." }, 503);
  }
}
