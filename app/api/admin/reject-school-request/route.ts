import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { data: superAdminRoles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1);

    if (roleError || !superAdminRoles?.length) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as {
      requestId?: string;
      notes?: string | null;
    } | null;

    const requestId = body?.requestId?.trim();
    const notes =
      typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) || null : null;

    if (!requestId) {
      return NextResponse.json(
        { error: "Falta el identificador de la solicitud." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.rpc("server_reject_school_registration_request", {
      request_id: requestId,
      reviewer_id: user.id,
      notes,
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error rechazando solicitud de centro:", error);
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo rechazar la solicitud de centro." },
      { status: 500 }
    );
  }
}
