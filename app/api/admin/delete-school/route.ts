import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(payload: unknown, opts: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(payload, {
    ...opts,
    headers: { ...PRIVATE_HEADERS, ...(opts.headers || {}) },
  });
}

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const guest = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return privateJson(
        { error: guest ? "No autenticado." : "No se pudo comprobar tu sesión." },
        { status: guest ? 401 : 503 }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return privateJson({ error: "No autenticado." }, { status: 401 });
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError) return privateJson({ error: "No se pudo comprobar tu permiso." }, { status: 503 });

    if (roleError || !roles?.length) {
      return privateJson({ error: "No autorizado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | { schoolId?: string }
      | null;

    const schoolId = body?.schoolId?.trim();
    if (!schoolId) {
      return privateJson({ error: "Falta el centro." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name, is_active")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) {
      return privateJson({ error: "Centro no encontrado." }, { status: 404 });
    }

    if (school.is_active !== false) {
      return privateJson(
        { error: "Desactiva primero el centro antes de eliminarlo." },
        { status: 409 }
      );
    }

    const [
      { count: profileCount, error: profileError },
      { count: listingCount, error: listingError },
      { count: schoolAdminCount, error: schoolAdminError },
      { count: roleCount, error: roleCountError },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      admin
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      admin
        .from("school_admins")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      admin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("school_id", schoolId),
    ]);

    if (profileError) throw profileError;
    if (listingError) throw listingError;
    if (schoolAdminError) throw schoolAdminError;
    if (roleCountError) throw roleCountError;

    const blockers = {
      profiles: profileCount || 0,
      listings: listingCount || 0,
      schoolAdmins: schoolAdminCount || 0,
      roles: roleCount || 0,
    };

    if (Object.values(blockers).some((value) => value > 0)) {
      const parts = [
        blockers.profiles ? `${blockers.profiles} usuario(s) vinculado(s)` : null,
        blockers.listings ? `${blockers.listings} anuncio(s)` : null,
        blockers.schoolAdmins ? `${blockers.schoolAdmins} administrador(es) de centro` : null,
        blockers.roles ? `${blockers.roles} rol(es) asociado(s)` : null,
      ].filter(Boolean);

      return privateJson(
        {
          error: `No se puede eliminar "${school.name}" mientras tenga ${parts.join(", ")}. Reasigna o desvincula esos datos primero.`,
          blockers,
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await admin
      .from("schools")
      .delete()
      .eq("id", schoolId);

    if (deleteError) throw deleteError;

    return privateJson({
      ok: true,
      message: `Centro "${school.name}" eliminado definitivamente.`,
    });
  } catch {
    console.error("school_delete_failed");
    return privateJson({ error: "No se pudo eliminar el centro." }, { status: 500 });
  }
}
